import { useId } from "react";
import type { NewWorkItem } from "../domain/types";
import { ItemForm } from "./ItemForm";
import { Modal } from "./Modal";

interface ItemDialogProps {
  onSubmit(values: NewWorkItem): Promise<void>;
  onCancel(): void;
}

/** Modal for creating a new item. Existing items open in the detail panel. */
export function ItemDialog({ onSubmit, onCancel }: ItemDialogProps) {
  const id = useId();
  return (
    <Modal title="New item" titleId={`${id}-title`} onClose={onCancel}>
      <ItemForm onSubmit={onSubmit} onCancel={onCancel} />
    </Modal>
  );
}
