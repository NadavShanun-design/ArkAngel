import { Card } from "../ui/card";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { SelectTrigger } from "../ui/select";
import { SelectValue } from "../ui/select";
import { SelectContent } from "../ui/select";
import { SelectItem } from "../ui/select";
import { Button } from "../ui/button";
import { SaveIcon } from "lucide-react";
import { Textarea } from "../ui/textarea";

export const ManageCustomProvider = ({
  editingProvider,
  saveError,
  formData,
  setFormData,
  errors,
  handleSave,
  resetForm,
}: {
  editingProvider: string | null;
  saveError: string | null;
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
  errors: { [key: string]: string };
  handleSave: () => void;
  resetForm: () => void;
}) => {
  return (
    <Card className="p-4 border border-input/50 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">
          {editingProvider ? "Edit" : "Add"} Custom Provider
        </h4>
        <div className="text-xs text-muted-foreground">
          Pre-filled with OpenAI-compatible defaults
        </div>
      </div>

      {/* Display save error */}
      {saveError && (
        <div className="text-xs text-destructive bg-destructive/10 p-3 rounded border border-destructive/20">
          ⚠️ {saveError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Basic Configuration */}
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-medium">Provider Name *</Label>
            <Input
              placeholder="My Custom Provider"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              className={`text-sm ${errors.name ? "border-destructive" : ""}`}
            />
            {errors.name && (
              <p className="text-xs text-destructive mt-1">{errors.name}</p>
            )}
          </div>

          <div>
            <Label className="text-xs font-medium">Base URL *</Label>
            <Input
              placeholder="https://api.example.com"
              value={formData.baseUrl}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  baseUrl: e.target.value,
                }))
              }
              className={`text-sm ${
                errors.baseUrl ? "border-destructive" : ""
              }`}
            />
            {errors.baseUrl && (
              <p className="text-xs text-destructive mt-1">{errors.baseUrl}</p>
            )}
          </div>

          <div>
            <Label className="text-xs font-medium">Chat Endpoint *</Label>
            <Input
              placeholder="/v1/chat/completions"
              value={formData.chatEndpoint}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  chatEndpoint: e.target.value,
                }))
              }
              className={`text-sm ${
                errors.chatEndpoint ? "border-destructive" : ""
              }`}
            />
            {errors.chatEndpoint && (
              <p className="text-xs text-destructive mt-1">
                {errors.chatEndpoint}
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs font-medium">Auth Type *</Label>
            <Select
              value={formData.authType}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, authType: value }))
              }
            >
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bearer">Bearer Token</SelectItem>
                <SelectItem value="custom-header">Custom Header</SelectItem>
                <SelectItem value="query">Query Parameter</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.authType === "custom-header" && (
            <div>
              <Label className="text-xs font-medium">Header Name</Label>
              <Input
                placeholder="x-api-key"
                value={formData.customHeaderName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    customHeaderName: e.target.value,
                  }))
                }
                className="text-sm"
              />
              <div className="mt-2 p-3 bg-muted/50 rounded-md border">
                <p className="text-xs font-medium text-foreground mb-1">
                  📝 Custom Header Authentication
                </p>
                <p className="text-xs text-muted-foreground mb-2">
                  Your API key will be sent as a custom header with the name you
                  specify.
                </p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    <strong>Example:</strong>
                  </p>
                  <p className="font-mono bg-background px-2 py-1 rounded border">
                    {formData.customHeaderName || "x-api-key"}: YOUR_API_KEY
                  </p>
                  <p className="mt-2">
                    <strong>Common header names:</strong> x-api-key,
                    x-goog-api-key, authorization, api-key
                  </p>
                  <p>
                    <strong>Use case:</strong> Many APIs use custom headers like
                    x-api-key, x-goog-api-key, or proprietary header names.
                  </p>
                </div>
              </div>
            </div>
          )}

          {formData.authType === "query" && (
            <div>
              <Label className="text-xs font-medium">Parameter Name</Label>
              <Input
                placeholder="key"
                value={formData.authParam}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    authParam: e.target.value,
                  }))
                }
                className="text-sm"
              />
              <div className="mt-2 p-3 bg-muted/50 rounded-md border">
                <p className="text-xs font-medium text-foreground mb-1">
                  📝 Query Parameter Authentication
                </p>
                <p className="text-xs text-muted-foreground mb-2">
                  Instead of sending the API key in headers, it will be added as
                  a URL parameter.
                </p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    <strong>Example:</strong>
                  </p>
                  <p className="font-mono bg-background px-2 py-1 rounded border">
                    https://api.example.com/chat?
                    {formData.authParam || "key"}=YOUR_API_KEY
                  </p>
                  <p className="mt-2">
                    <strong>Common parameter names:</strong> key, apikey,
                    api_key, token
                  </p>
                  <p>
                    <strong>Use case:</strong> Some APIs (like Google's) require
                    the API key as a query parameter instead of in headers.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs font-medium">Default Model</Label>
            <Input
              placeholder="gpt-4"
              value={formData.defaultModel}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  defaultModel: e.target.value,
                }))
              }
              className="text-sm"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="supportsStreaming"
              checked={formData.supportsStreaming}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  supportsStreaming: e.target.checked,
                }))
              }
              className="rounded"
            />
            <Label htmlFor="supportsStreaming" className="text-xs font-medium">
              Supports Streaming
            </Label>
          </div>
        </div>

        {/* Response Configuration */}
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-medium">
              Response Content Path *
            </Label>
            <Input
              placeholder="choices[0].message.content"
              value={formData.responseContentPath}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  responseContentPath: e.target.value,
                }))
              }
              className={`text-sm ${
                errors.responseContentPath ? "border-destructive" : ""
              }`}
            />
            {errors.responseContentPath && (
              <p className="text-xs text-destructive mt-1">
                {errors.responseContentPath}
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs font-medium">Response Usage Path</Label>
            <Input
              placeholder="usage"
              value={formData.responseUsagePath}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  responseUsagePath: e.target.value,
                }))
              }
              className="text-sm"
            />
          </div>

          <div>
            <Label className="text-xs font-medium">
              Text Message Structure (JSON)
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Structure for each individual user text message
            </p>
            <Textarea
              placeholder='{"role": "user", "content": "Your text message here"}'
              value={formData.textExampleStructure}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  textExampleStructure: e.target.value,
                }))
              }
              className={`text-sm h-20 font-mono ${
                errors.textExampleStructure ? "border-destructive" : ""
              }`}
            />
            {errors.textExampleStructure && (
              <p className="text-xs text-destructive mt-1">
                {errors.textExampleStructure}
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs font-medium">Image Input Type</Label>
            <Select
              value={formData.imageType}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, imageType: value }))
              }
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select image type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="url_or_base64">URL or Base64</SelectItem>
                <SelectItem value="base64">Base64 Only</SelectItem>
                <SelectItem value="url">URL Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-medium">
              Image Message Structure (JSON)
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Structure for each individual user message with images
            </p>
            <Textarea
              placeholder='{"role": "user", "content": [{"type": "text", "text": "Describe this image:"}, {"type": "image_url", "image_url": {"url": "https://example.com/image.jpg"}}]}'
              value={formData.imageExampleStructure}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  imageExampleStructure: e.target.value,
                }))
              }
              className={`text-sm h-24 font-mono ${
                errors.imageExampleStructure ? "border-destructive" : ""
              }`}
            />
            {errors.imageExampleStructure && (
              <p className="text-xs text-destructive mt-1">
                {errors.imageExampleStructure}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" onClick={resetForm}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={
            !formData.name.trim() ||
            !formData.baseUrl.trim() ||
            !formData.chatEndpoint.trim()
          }
        >
          <SaveIcon className="h-4 w-4 mr-2" />
          {editingProvider ? "Update" : "Save"} Provider
        </Button>
      </div>
    </Card>
  );
};
