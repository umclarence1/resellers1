import { useState } from 'react';
import { X } from 'lucide-react';
import Button from '@/components/ui/Button';
import FormAlert from '@/components/ui/FormAlert';
import AdminPasswordConfirm from '@/components/admin/AdminPasswordConfirm';

type Props = {
  title: string;
  description?: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (adminOtp: string) => Promise<void>;
};

export default function AdminActionConfirmModal({
  title,
  description,
  confirmLabel = 'Confirm',
  onClose,
  onConfirm,
}: Props) {
  const [adminOtp, setAdminOtp] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(adminOtp)) {
      setError('Enter the 6-digit verification code from your email');
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(adminOtp);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">{title}</h2>
            {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <AdminPasswordConfirm
            value={adminOtp}
            onChange={setAdminOtp}
            autoSendOnMount
          />
          <FormAlert message={error} />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={submitting}>
              {confirmLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
