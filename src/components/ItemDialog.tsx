import { useId } from "react";
import type { NewWorkItem } from "../domain/types";
import { ItemForm, type ParentOption } from "./ItemForm";
import { Modal } from "./Modal";

interface ItemDialogProps {
  parentOptions: ParentOption[];
  onSubmit(values: NewWorkItem): Promise<void>;
  onCancel(): void;
}

/** Modal for creating a new item. Existing items open in the detail panel. */
export function ItemDialog({ parentOptions, onSubmit, onCancel }: ItemDialogProps) {
  const id = useId();
  return (
    <Modal title="New item" titleId={`${id}-title`} onClose={onCancel}>
      <ItemForm parentOptions={parentOptions} onSubmit={onSubmit} onCancel={onCancel} />
    </Modal>
  );
}
