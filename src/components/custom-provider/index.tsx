import { PlusIcon, TrashIcon, EditIcon } from "lucide-react";
import { Button, Label, Card } from "@/components";
import { DeleteCustomProvider } from "./deleteCustomProvider";
import { ManageCustomProvider } from "./Manage";
import { CustomProvider } from "@/types";

interface CustomProviderProps {
  customProviders: CustomProvider[];
  showForm: boolean;
  setShowForm: (show: boolean) => void;
  editingProvider: string | null;
  errors: { [key: string]: string };
  saveError: string | null;
  deleteConfirm: string | null;
  formData: {
    name: string;
    baseUrl: string;
    chatEndpoint: string;
    authType: string;
    authParam: string;
    customHeaderName: string;
    defaultModel: string;
    supportsStreaming: boolean;
    responseContentPath: string;
    responseUsagePath: string;
    textExampleStructure: string;
    imageType: string;
    imageExampleStructure: string;
  };
  setFormData: React.Dispatch<
    React.SetStateAction<{
      name: string;
      baseUrl: string;
      chatEndpoint: string;
      authType: string;
      authParam: string;
      customHeaderName: string;
      defaultModel: string;
      supportsStreaming: boolean;
      responseContentPath: string;
      responseUsagePath: string;
      textExampleStructure: string;
      imageType: string;
      imageExampleStructure: string;
    }>
  >;
  handleEdit: (provider: CustomProvider) => void;
  handleSave: () => void;
  handleDelete: (id: string) => void;
  confirmDelete: () => void;
  cancelDelete: () => void;
  resetForm: () => void;
}

export const CustomProviderComponent = ({
  customProviders,
  showForm,
  setShowForm,
  editingProvider,
  errors,
  saveError,
  deleteConfirm,
  formData,
  setFormData,
  handleEdit,
  handleSave,
  handleDelete,
  confirmDelete,
  cancelDelete,
  resetForm,
}: CustomProviderProps) => {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-semibold flex items-center gap-2">
          Custom Providers
        </Label>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Create and manage custom AI providers. Configure endpoints,
          authentication, and response formats.
        </p>
      </div>

      {/* Existing Custom Providers */}
      {customProviders.length > 0 && (
        <div className="space-y-2">
          {customProviders.map((provider) => (
            <Card key={provider.id} className="p-3 border border-input/50">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm">{provider.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {provider.baseUrl}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(provider)}
                    title="Edit Provider"
                  >
                    <EditIcon className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      handleDelete(provider.id);
                    }}
                    title="Delete Provider"
                    className="text-destructive hover:text-destructive"
                  >
                    <TrashIcon className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Form */}
      {!showForm ? (
        <Button
          onClick={() => setShowForm(true)}
          variant="outline"
          className="w-full"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Custom Provider
        </Button>
      ) : (
        <ManageCustomProvider
          editingProvider={editingProvider}
          saveError={saveError}
          formData={formData}
          setFormData={setFormData}
          errors={errors}
          handleSave={handleSave}
          resetForm={resetForm}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <DeleteCustomProvider
          cancelDelete={cancelDelete}
          confirmDelete={confirmDelete}
        />
      )}
    </div>
  );
};
