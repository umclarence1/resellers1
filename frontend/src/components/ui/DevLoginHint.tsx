interface DevLoginHintProps {
  email: string;
  password: string;
  label?: string;
}

export default function DevLoginHint({ email, password, label }: DevLoginHintProps) {
  if (!import.meta.env.DEV) return null;

  return (
    <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-900">
      <p className="font-medium mb-1">Dev login (OTP skipped)</p>
      {label && <p className="text-emerald-800 mb-1">{label}</p>}
      <p>
        <span className="text-emerald-700">Email:</span> {email}
      </p>
      <p>
        <span className="text-emerald-700">Password:</span> {password}
      </p>
    </div>
  );
}
