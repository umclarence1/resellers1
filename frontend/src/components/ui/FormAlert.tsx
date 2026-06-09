import { AlertCircle } from 'lucide-react';

export default function FormAlert({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-red-200/80 bg-red-50 px-3.5 py-3 text-sm text-red-700"
    >
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 shrink-0 mt-0.5">
        <AlertCircle className="w-3.5 h-3.5" />
      </span>
      <p className="leading-relaxed">{message}</p>
    </div>
  );
}
