import { useState, useEffect } from "react";
import { CustomProvider } from "@/types";
import {
  loadCustomProvidersFromStorage,
  addCustomProvider,
  deleteCustomProvider,
} from "@/lib/storage";

export const useCustomProvider = (onProviderAdded: () => void) => {
  const [showForm, setShowForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [saveError, setSaveError] = useState<string>("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    baseUrl: "",
    chatEndpoint: "/v1/chat/completions",
    authType: "bearer",
    authParam: "",
    customHeaderName: "",
    defaultModel: "",
    supportsStreaming: true,
    responseContentPath: "choices[0].message.content",
    responseUsagePath: "usage",
    textExampleStructure: JSON.stringify(
      {
        role: "user",
        content: "Your text message here",
      },
      null,
      2
    ),
    imageType: "url_or_base64",
    imageExampleStructure: JSON.stringify(
      {
        role: "user",
        content: [
          { type: "text", text: "Describe this image:" },
          {
            type: "image_url",
            image_url: { url: "https://example.com/image.jpg" },
          },
        ],
      },
      null,
      2
    ),
  });

  const [customProviders, setCustomProviders] = useState<CustomProvider[]>([]);

  // Load custom providers on component mount and when form changes
  useEffect(() => {
    const providers = loadCustomProvidersFromStorage();
    setCustomProviders(providers);
  }, [showForm, editingProvider]);

  const resetForm = () => {
    setFormData({
      name: "",
      baseUrl: "",
      chatEndpoint: "/v1/chat/completions",
      authType: "bearer",
      authParam: "",
      customHeaderName: "",
      defaultModel: "",
      supportsStreaming: true,
      responseContentPath: "choices[0].message.content",
      responseUsagePath: "usage",
      textExampleStructure: JSON.stringify(
        {
          role: "user",
          content: "Your text message here",
        },
        null,
        2
      ),
      imageType: "url_or_base64",
      imageExampleStructure: JSON.stringify(
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this image:" },
            {
              type: "image_url",
              image_url: { url: "https://example.com/image.jpg" },
            },
          ],
        },
        null,
        2
      ),
    });
    setShowForm(false);
    setEditingProvider(null);
    setErrors({});
    setSaveError("");
  };

  const generateId = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .substring(0, 20);
  };

  const handleEdit = (provider: CustomProvider) => {
    setFormData({
      name: provider.name,
      baseUrl: provider.baseUrl,
      chatEndpoint: provider.chatEndpoint,
      authType: provider.authType,
      authParam: provider.authParam || "",
      customHeaderName: provider.customHeaderName || "",
      defaultModel: provider.defaultModel,
      supportsStreaming: provider.supportsStreaming,
      responseContentPath: provider.response.contentPath,
      responseUsagePath: provider.response.usagePath,
      textExampleStructure: JSON.stringify(
        provider.input.text.exampleStructure,
        null,
        2
      ),
      imageType: provider.input.image.type,
      imageExampleStructure: JSON.stringify(
        provider.input.image.exampleStructure,
        null,
        2
      ),
    });
    setEditingProvider(provider.id);
    setShowForm(true);
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      newErrors.name = "Provider name is required";
    }

    if (!formData.baseUrl.trim()) {
      newErrors.baseUrl = "Base URL is required";
    } else {
      try {
        new URL(formData.baseUrl.trim());
      } catch {
        newErrors.baseUrl = "Please enter a valid URL";
      }
    }

    if (!formData.chatEndpoint.trim()) {
      newErrors.chatEndpoint = "Chat endpoint is required";
    }

    if (!formData.responseContentPath.trim()) {
      newErrors.responseContentPath = "Response content path is required";
    }

    // Validate JSON structures
    if (formData.textExampleStructure.trim()) {
      try {
        JSON.parse(formData.textExampleStructure);
      } catch {
        newErrors.textExampleStructure = "Invalid JSON format";
      }
    }

    if (formData.imageExampleStructure.trim()) {
      try {
        JSON.parse(formData.imageExampleStructure);
      } catch {
        newErrors.imageExampleStructure = "Invalid JSON format";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    setSaveError("");

    if (!validateForm()) {
      setSaveError("Please fix the errors above before saving.");
      return;
    }

    try {
      const provider: CustomProvider = {
        id: editingProvider || generateId(formData.name),
        name: formData.name.trim(),
        baseUrl: formData.baseUrl.trim(),
        chatEndpoint: formData.chatEndpoint.trim(),
        authType: formData.authType,
        authParam: formData.authParam.trim() || undefined,
        customHeaderName: formData.customHeaderName.trim() || undefined,
        defaultModel: formData.defaultModel.trim(),
        supportsStreaming: formData.supportsStreaming,
        response: {
          contentPath: formData.responseContentPath.trim(),
          usagePath: formData.responseUsagePath.trim(),
        },
        input: {
          text: {
            placement: "",
            exampleStructure: formData.textExampleStructure.trim()
              ? JSON.parse(formData.textExampleStructure)
              : {},
          },
          image: {
            type: formData.imageType.trim(),
            placement: "",
            exampleStructure: formData.imageExampleStructure.trim()
              ? JSON.parse(formData.imageExampleStructure)
              : {},
          },
        },
        models: null,
        isCustom: true,
      };

      addCustomProvider(provider);
      // Refresh the local state immediately
      setCustomProviders(loadCustomProvidersFromStorage());
      resetForm();
      onProviderAdded();
    } catch (error) {
      console.error("Failed to save custom provider:", error);
      setSaveError(
        error instanceof Error
          ? `Failed to save provider: ${error.message}`
          : "Failed to save provider. Please check your input."
      );
    }
  };

  const handleDelete = (providerId: string) => {
    setDeleteConfirm(providerId);
  };

  const confirmDelete = () => {
    const providerId = deleteConfirm;
    if (!providerId) return;

    try {
      deleteCustomProvider(providerId);

      // Refresh the local state immediately
      const updatedProviders = loadCustomProvidersFromStorage();
      setCustomProviders(updatedProviders);

      // Notify parent component
      onProviderAdded();
    } catch (error) {
      console.error("Failed to delete custom provider:", error);
      alert("Failed to delete custom provider. Please try again.");
    }

    setDeleteConfirm(null);
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  return {
    customProviders,
    setCustomProviders,
    showForm,
    setShowForm,
    editingProvider,
    setEditingProvider,
    errors,
    setErrors,
    saveError,
    setSaveError,
    deleteConfirm,
    setDeleteConfirm,
    formData,
    setFormData,
    handleEdit,
    handleSave,
    handleDelete,
    confirmDelete,
    cancelDelete,
    resetForm,
  };
};
