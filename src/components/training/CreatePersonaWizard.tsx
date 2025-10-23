import React, { useState } from "react";
import { Button, SpotlightArea, Input, Textarea, Label, LogViewer } from "@/components";
import { X, Check, ArrowRight, ArrowLeft, FileText, Loader2, Terminal } from "lucide-react";
import { listen, UnlistenFn } from '@tauri-apps/api/event';

interface TrainingDataItem {
  id: string;
  source_type: string;
  title: string;
  content: string;
  metadata: any;
  added_at: string;
  format: string;
}

interface CreatePersonaWizardProps {
  trainingItems: TrainingDataItem[];
  onClose: () => void;
  onComplete: (personaId: string) => void;
}

type WizardStep = 1 | 2 | 3 | 4;

export const CreatePersonaWizard: React.FC<CreatePersonaWizardProps> = ({
  trainingItems,
  onClose,
  onComplete,
}) => {
  const [step, setStep] = useState<WizardStep>(1);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [personaName, setPersonaName] = useState("");
  const [personaDescription, setPersonaDescription] = useState("");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [createdPersonaId, setCreatedPersonaId] = useState<string | null>(null);

  // Real-time progress tracking
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [statusDetails, setStatusDetails] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [totalSteps, setTotalSteps] = useState<number>(5);
  const [showLogs, setShowLogs] = useState<boolean>(false);

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const selectAll = (type?: "documents" | "transcripts") => {
    setSelectedItems(new Set(
      trainingItems
        .filter(item => !type || item.source_type === (type === "documents" ? "document" : "transcript"))
        .map(item => item.id)
    ));
  };

  const deselectAll = () => {
    setSelectedItems(new Set());
  };

  const handleNext = () => {
    if (step === 1 && selectedItems.size === 0) {
      setError("Please select at least one training item");
      return;
    }
    if (step === 2 && !personaName.trim()) {
      setError("Please enter a persona name");
      return;
    }
    setError(null);
    if (step < 3) {
      setStep((step + 1) as WizardStep);
    } else {
      handleCreatePersona();
    }
  };

  const handleBack = () => {
    setError(null);
    if (step > 1) {
      setStep((step - 1) as WizardStep);
    }
  };

  const handleCreatePersona = async () => {
    console.log('\n========================================');
    console.log('🚀 [CreatePersona] STARTING PERSONA CREATION');
    console.log('========================================');
    console.log('[CreatePersona] Name:', personaName);
    console.log('[CreatePersona] Description:', personaDescription);
    console.log('[CreatePersona] Selected items:', Array.from(selectedItems));
    console.log('[CreatePersona] Number of items:', selectedItems.size);

    setProcessing(true);
    setProgress(0);
    setStep(3);
    setError(null);
    setStatusMessage('Initializing...');
    setStatusDetails(null);
    setCurrentStep(0);

    let unlistenProgress: UnlistenFn | null = null;
    let unlistenLog: UnlistenFn | null = null;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      console.log('[CreatePersona] ✅ Tauri invoke API loaded');

      // Listen for real-time progress events from Rust backend
      console.log('[CreatePersona] 📡 Setting up event listener for "rag_progress"...');
      unlistenProgress = await listen<{
        status: string;
        step: number;
        total_steps: number;
        percentage: number;
        details: string | null;
      }>('rag_progress', (event) => {
        console.log('\n🎯 [CreatePersona] RAG PROGRESS EVENT RECEIVED!');
        console.log('[CreatePersona] Event:', event);
        console.log('[CreatePersona] Payload:', JSON.stringify(event.payload, null, 2));
        console.log('[CreatePersona] Status:', event.payload.status);
        console.log('[CreatePersona] Step:', event.payload.step, '/', event.payload.total_steps);
        console.log('[CreatePersona] Percentage:', event.payload.percentage + '%');

        // Update UI immediately with each event
        setStatusMessage(event.payload.status);
        setStatusDetails(event.payload.details);
        setProgress(event.payload.percentage);
        setCurrentStep(event.payload.step);
        setTotalSteps(event.payload.total_steps);

        console.log('[CreatePersona] ✅ UI state updated\n');
      });

      console.log('[CreatePersona] ✅ Progress event listener registered');

      // Also listen for app_log events
      console.log('[CreatePersona] 📡 Setting up event listener for "app_log"...');
      unlistenLog = await listen('app_log', (event) => {
        console.log('📝 [CreatePersona] LOG EVENT:', event.payload);
      });

      console.log('[CreatePersona] ✅ Log event listener registered');
      console.log('[CreatePersona] 🔄 Waiting 100ms to ensure listeners are ready...');
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('\n[CreatePersona] 🎬 Calling create_rag_persona Tauri command...');
      console.log('[CreatePersona] Parameters:');
      console.log('  - name:', personaName);
      console.log('  - description:', personaDescription);
      console.log('  - trainingItemIds:', Array.from(selectedItems));

      // Call backend to create RAG persona
      const persona = await invoke<any>('create_rag_persona', {
        name: personaName,
        description: personaDescription,
        trainingItemIds: Array.from(selectedItems),
      });

      console.log('\n✅ [CreatePersona] INVOKE COMPLETED SUCCESSFULLY!');

      console.log('[CreatePersona] Persona created:', persona);
      console.log('[CreatePersona] Persona ID:', persona.id);
      console.log('[CreatePersona] Persona name:', persona.name);
      console.log('========================================\n');

      setCreatedPersonaId(persona.id);

      // Clean up event listeners
      if (unlistenProgress) {
        console.log('[CreatePersona] Cleaning up progress listener');
        unlistenProgress();
      }
      if (unlistenLog) {
        console.log('[CreatePersona] Cleaning up log listener');
        unlistenLog();
      }

      // Small delay to show 100% before transitioning
      setTimeout(() => {
        setStep(4);
        setProcessing(false);
      }, 800);
    } catch (err) {
      console.error('\n❌ [CreatePersona] ERROR OCCURRED!');
      console.error('========================================');
      console.error('[CreatePersona] Error:', err);
      console.error('[CreatePersona] Error type:', typeof err);
      console.error('[CreatePersona] Error string:', String(err));

      if (err instanceof Error) {
        console.error('[CreatePersona] Error message:', err.message);
        console.error('[CreatePersona] Error stack:', err.stack);
      }

      try {
        console.error('[CreatePersona] Error JSON:', JSON.stringify(err, null, 2));
      } catch (e) {
        console.error('[CreatePersona] Could not stringify error');
      }
      console.error('========================================\n');

      // Clean up event listeners on error
      if (unlistenProgress) {
        console.log('[CreatePersona] Cleaning up progress listener');
        unlistenProgress();
      }
      if (unlistenLog) {
        console.log('[CreatePersona] Cleaning up log listener');
        unlistenLog();
      }

      const errorMessage = err instanceof Error
        ? err.message
        : typeof err === 'string'
        ? err
        : `Failed to create persona: ${JSON.stringify(err)}`;

      setError(errorMessage);
      setProcessing(false);
      setProgress(0);
      setStep(2); // Go back to config step so user can try again
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3, 4].map((s) => (
        <div
          key={s}
          className={`h-2 rounded-full transition-all ${
            s === step
              ? "w-8 bg-primary"
              : s < step
              ? "w-2 bg-primary/50"
              : "w-2 bg-muted"
          }`}
        />
      ))}
    </div>
  );

  const renderStep1 = () => {
    const documents = trainingItems.filter(i => i.source_type === "document");
    const transcripts = trainingItems.filter(i => i.source_type === "transcript");

    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Select Training Data</h3>
          <p className="text-sm text-muted-foreground">
            Choose the documents and transcripts you want to include in this RAG persona
          </p>
        </div>

        {/* Selection Controls */}
        <div className="flex gap-2">
          <Button onClick={() => selectAll()} size="sm" variant="outline">
            Select All ({trainingItems.length})
          </Button>
          <Button onClick={() => selectAll("documents")} size="sm" variant="outline">
            All Documents ({documents.length})
          </Button>
          <Button onClick={() => selectAll("transcripts")} size="sm" variant="outline">
            All Transcripts ({transcripts.length})
          </Button>
          <Button onClick={deselectAll} size="sm" variant="outline">
            Deselect All
          </Button>
        </div>

        {/* Documents Section */}
        {documents.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Documents ({documents.length})</h4>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {documents.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-accent/20 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={() => toggleItemSelection(item.id)}
                    className="w-4 h-4"
                  />
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm flex-1 truncate">{item.title}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Transcripts Section */}
        {transcripts.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Transcripts ({transcripts.length})</h4>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {transcripts.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-accent/20 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={() => toggleItemSelection(item.id)}
                    className="w-4 h-4"
                  />
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm flex-1 truncate">{item.title}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-input/50">
          <p className="text-sm text-muted-foreground">
            Selected: <span className="font-medium">{selectedItems.size}</span> items
          </p>
        </div>
      </div>
    );
  };

  const renderStep2 = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Configure Persona</h3>
        <p className="text-sm text-muted-foreground">
          Give your RAG persona a name and description
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="persona-name" className="text-sm font-medium">
            Persona Name *
          </Label>
          <Input
            id="persona-name"
            value={personaName}
            onChange={(e) => setPersonaName(e.target.value)}
            placeholder="e.g., Technical Documentation Expert"
            className="mt-1"
            autoFocus
          />
        </div>

        <div>
          <Label htmlFor="persona-description" className="text-sm font-medium">
            Description (Optional)
          </Label>
          <Textarea
            id="persona-description"
            value={personaDescription}
            onChange={(e) => setPersonaDescription(e.target.value)}
            placeholder="Describe what this persona knows and how it should respond..."
            className="mt-1 min-h-[120px]"
          />
        </div>

        <SpotlightArea className="p-4 border border-input/50 rounded-md bg-primary/5">
          <div className="text-sm">
            <p className="font-medium mb-2">Training Data Summary:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• {selectedItems.size} total items selected</li>
              <li>
                • {trainingItems.filter(i => selectedItems.has(i.id) && i.source_type === "document").length} documents
              </li>
              <li>
                • {trainingItems.filter(i => selectedItems.has(i.id) && i.source_type === "transcript").length} transcripts
              </li>
            </ul>
          </div>
        </SpotlightArea>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6 py-4">
      <div className="text-center">
        <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin mb-4" />
        <h3 className="text-lg font-semibold mb-2">Creating RAG Persona</h3>
        <p className="text-sm text-muted-foreground">
          {statusMessage || 'Processing your training data...'}
        </p>
        {statusDetails && (
          <p className="text-xs text-muted-foreground mt-1">
            {statusDetails}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Step {currentStep} of {totalSteps}
          </span>
          <span className="font-medium">{progress}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Real-time step breakdown with checkmarks */}
      <div className="space-y-2 text-sm">
        <div className={`flex items-center gap-2 ${currentStep >= 1 ? "text-primary font-medium" : "text-muted-foreground"}`}>
          {currentStep > 1 ? <Check className="w-4 h-4" /> :
           currentStep === 1 ? <ArrowRight className="w-4 h-4" /> :
           <div className="w-4 h-4 rounded-full border-2 border-current" />}
          <span>Validating training data</span>
        </div>
        <div className={`flex items-center gap-2 ${currentStep >= 2 ? "text-primary font-medium" : "text-muted-foreground"}`}>
          {currentStep > 2 ? <Check className="w-4 h-4" /> :
           currentStep === 2 ? <ArrowRight className="w-4 h-4" /> :
           <div className="w-4 h-4 rounded-full border-2 border-current" />}
          <span>Loading training items</span>
        </div>
        <div className={`flex items-center gap-2 ${currentStep >= 3 ? "text-primary font-medium" : "text-muted-foreground"}`}>
          {currentStep > 3 ? <Check className="w-4 h-4" /> :
           currentStep === 3 ? <ArrowRight className="w-4 h-4" /> :
           <div className="w-4 h-4 rounded-full border-2 border-current" />}
          <span>Extracting text content</span>
        </div>
        <div className={`flex items-center gap-2 ${currentStep >= 4 ? "text-primary font-medium" : "text-muted-foreground"}`}>
          {currentStep > 4 ? <Check className="w-4 h-4" /> :
           currentStep === 4 ? <ArrowRight className="w-4 h-4" /> :
           <div className="w-4 h-4 rounded-full border-2 border-current" />}
          <span>Creating persona file</span>
        </div>
        <div className={`flex items-center gap-2 ${currentStep >= 5 ? "text-primary font-medium" : "text-muted-foreground"}`}>
          {currentStep === 5 ? <Check className="w-4 h-4" /> :
           <div className="w-4 h-4 rounded-full border-2 border-current" />}
          <span>Saving persona</span>
        </div>
      </div>

      {/* Log Toggle Button */}
      <div className="flex justify-center pt-2">
        <Button
          onClick={() => setShowLogs(!showLogs)}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Terminal className="w-3 h-3" />
          {showLogs ? 'Hide Logs' : 'Show Logs'}
        </Button>
      </div>

      {/* Real-time Logs */}
      {showLogs && (
        <div className="mt-4">
          <LogViewer
            title="RAG Creation Logs"
            maxLogs={500}
            showControls={true}
            height="300px"
            eventChannel="app_log"
          />
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6 py-8">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
          <Check className="w-10 h-10 text-green-500" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Persona Created Successfully!</h3>
        <p className="text-sm text-muted-foreground">
          Your RAG persona "{personaName}" is ready to use
        </p>
      </div>

      <SpotlightArea className="p-4 border border-input/50 rounded-md bg-primary/5">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name:</span>
            <span className="font-medium">{personaName}</span>
          </div>
          {personaDescription && (
            <div>
              <span className="text-muted-foreground">Description:</span>
              <p className="mt-1 text-foreground">{personaDescription}</p>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Training Items:</span>
            <span className="font-medium">{selectedItems.size}</span>
          </div>
        </div>
      </SpotlightArea>

      <div className="flex gap-2">
        <Button
          onClick={() => createdPersonaId && onComplete(createdPersonaId)}
          className="flex-1"
        >
          Use Persona
        </Button>
        <Button onClick={onClose} variant="outline" className="flex-1">
          Done
        </Button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <SpotlightArea className="w-full max-w-2xl mx-4 bg-background border border-input/50 rounded-lg shadow-lg">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Create RAG Persona</h2>
            <Button
              onClick={onClose}
              size="icon"
              variant="ghost"
              disabled={processing}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Step Indicator */}
          {renderStepIndicator()}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Step Content */}
          <div className="min-h-[400px]">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
          </div>

          {/* Navigation */}
          {step < 3 && (
            <div className="flex items-center justify-between gap-3 mt-6 pt-6 border-t border-input/50">
              <Button
                onClick={handleBack}
                variant="outline"
                disabled={step === 1}
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <Button onClick={handleNext}>
                {step === 2 ? "Create Persona" : "Next"}
                {step < 2 && <ArrowRight className="w-4 h-4 ml-1" />}
              </Button>
            </div>
          )}
        </div>
      </SpotlightArea>
    </div>
  );
};
