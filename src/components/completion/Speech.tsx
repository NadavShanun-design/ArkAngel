import { getSettings, transcribeAudio } from "@/lib";
import { CompletionState } from "@/types";
import { useMicVAD } from "@ricky0123/vad-react";
import { LoaderCircleIcon, MicIcon, MicOffIcon } from "lucide-react";
import React, { useState } from "react";
import { Button } from "../ui/button";

export const Speech = ({
  submit,
  setState,
  setEnableVAD,
}: {
  submit: (transcription: string) => void;
  setState: React.Dispatch<React.SetStateAction<CompletionState>>;
  setEnableVAD: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const [isTranscribing, setIsTranscribing] = useState(false);

  const vad = useMicVAD({
    userSpeakingThreshold: 0.6,
    startOnLoad: true,
    onSpeechEnd: async (audio) => {
      console.log("🔍 VAD onSpeechEnd TRIGGERED!");
      console.log("🔍 Audio data:", audio);
      console.log("🔍 Audio type:", typeof audio);
      console.log("🔍 Audio length:", audio?.length);
      
      try {
        console.log("🔍 Starting transcription process...");
        setIsTranscribing(true);
        const settings = getSettings();
        console.log("🔍 Settings retrieved:", settings);

        // Check if we have an OpenAI API key for transcription
        let openAiKey = "";
        if (settings.selectedProvider === "openai") {
          console.log("🔍 Using OpenAI provider");
          if (!settings?.apiKey || !settings?.isApiKeySubmitted) {
            console.warn("🔍 No OpenAI API key configured for transcription");
            return;
          }
          openAiKey = settings.apiKey;
          console.log("🔍 OpenAI API key found, length:", openAiKey.length);
        } else {
          console.log("🔍 Using separate OpenAI key for provider:", settings.selectedProvider);
          if (!settings?.openAiApiKey || !settings?.isOpenAiApiKeySubmitted) {
            console.warn("🔍 No OpenAI API key configured for speech-to-text");
            return;
          }
          openAiKey = settings.openAiApiKey;
          console.log("🔍 Separate OpenAI API key found, length:", openAiKey.length);
        }

        console.log("🔍 Calling transcribeAudio...");
        const transcription = await transcribeAudio(audio, openAiKey);
        console.log("🔍 Transcription result:", transcription);
        
        if (transcription) {
          console.log("🔍 Submitting transcription:", transcription);
          submit(transcription);
        } else {
          console.warn("🔍 No transcription returned");
        }
      } catch (error) {
        console.error("🔍 ERROR in transcription:", error);
        setState((prev) => ({
          ...prev,
          error:
            error instanceof Error ? error.message : "Transcription failed",
        }));
      } finally {
        setIsTranscribing(false);
        console.log("🔍 Transcription process completed");
      }
    },
  });

  // Add VAD state debugging
  React.useEffect(() => {
    console.log("🔍 VAD State Debug:");
    console.log("🔍 VAD listening:", vad.listening);
    console.log("🔍 VAD userSpeaking:", vad.userSpeaking);
    console.log("🔍 VAD loading:", vad.loading);
    console.log("🔍 VAD error:", vad.error);
  }, [vad.listening, vad.userSpeaking, vad.loading, vad.error]);

  return (
    <>
      <Button
        size="icon"
        onClick={() => {
          if (vad.listening) {
            vad.pause();
            setEnableVAD(false);
          } else {
            vad.start();
            setEnableVAD(true);
          }
        }}
        className="cursor-pointer"
      >
        {isTranscribing ? (
          <LoaderCircleIcon className="h-4 w-4 animate-spin text-green-500" />
        ) : vad.userSpeaking ? (
          <LoaderCircleIcon className="h-4 w-4 animate-spin" />
        ) : vad.listening ? (
          <MicOffIcon className="h-4 w-4 animate-pulse" />
        ) : (
          <MicIcon className="h-4 w-4" />
        )}
      </Button>
    </>
  );
};
