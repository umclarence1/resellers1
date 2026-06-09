import { AlertCircle } from 'lucide-react';

export default function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;

  return (
    <p
      id={id}
      role="alert"
      className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600"
    >
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-100 shrink-0">
        <AlertCircle className="w-3 h-3" />
      </span>
      {message}
    </p>
  );
}
