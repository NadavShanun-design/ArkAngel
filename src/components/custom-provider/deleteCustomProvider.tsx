import { Button } from "../ui/button";

export const DeleteCustomProvider = ({
  cancelDelete,
  confirmDelete,
}: {
  cancelDelete: () => void;
  confirmDelete: () => void;
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg p-6 max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-2">Delete Custom Provider</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Are you sure you want to delete this custom provider? This action
          cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={cancelDelete}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirmDelete}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
};
