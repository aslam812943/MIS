export interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  isDanger: boolean;
  onConfirm: () => void;
}

export const INITIAL_CONFIRM_STATE: ConfirmDialogState = {
  isOpen: false,
  title: '',
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  isDanger: true,
  onConfirm: () => {},
};
