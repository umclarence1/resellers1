import { useState } from 'react';
import { X } from 'lucide-react';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import FormAlert from '@/components/ui/FormAlert';
import AdminPasswordConfirm from '@/components/admin/AdminPasswordConfirm';
import { api } from '@/lib/api';

export default function AdminRewardModal({
  role,
  userId,
  fullName,
  onClose,
  onSuccess,
}: {
  role: 'agent' | 'reseller';
  userId: string;
  fullName: string;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [adminOtp, setAdminOtp] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const parsed = Number(amount);
    if (!amount || Number.isNaN(parsed) || parsed <= 0) {
      setError('Enter a valid reward amount greater than zero');
      return;
    }
    if (!/^\d{6}$/.test(adminOtp)) {
      setError('Enter the 6-digit verification code from your email');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/admin/${role}s/${userId}/reward`, {
        amount: parsed,
        note: note.trim() || undefined,
        adminOtp,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reward');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Reward {role}</h2>
            <p className="text-sm text-gray-500">{fullName}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Input
            label="Amount (GHS)"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 50"
          />
          <Textarea
            label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Top performer this month"
            rows={3}
          />
          <AdminPasswordConfirm value={adminOtp} onChange={setAdminOtp} autoSendOnMount />
          <FormAlert message={error} />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={submitting}>
              Send reward
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
