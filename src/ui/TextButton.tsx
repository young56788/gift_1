type TextButtonProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

export function TextButton({ label, onClick, disabled }: TextButtonProps) {
  return (
    <button className="text-button" onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}
