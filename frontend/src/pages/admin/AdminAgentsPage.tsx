import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PasswordInput from '@/components/ui/PasswordInput';
import { validatePasswordPolicy } from '@/lib/password-strength';
import FormAlert from '@/components/ui/FormAlert';
import { runValidators, v } from '@/lib/form-validation';
import { useNavigate } from 'react-router-dom';
import AdminRewardModal from '@/components/admin/AdminRewardModal';
import AdminAgentTopUpModal from '@/components/admin/AdminAgentTopUpModal';
import AdminPasswordConfirm from '@/components/admin/AdminPasswordConfirm';
import ActionChip from '@/components/admin/ActionChip';
import { formatCurrency } from '@/lib/utils';
import { Gift, Loader2, Trash2, UserCheck, UserX, Wallet } from 'lucide-react';

type AgentRow = {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  status: string;
  walletBalance?: number;
};

export default function AdminAgentsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', adminOtp: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [rewardTarget, setRewardTarget] = useState<{ id: string; fullName: string } | null>(null);
  const [topUpTarget, setTopUpTarget] = useState<{ id: string; fullName: string; balance: number } | null>(null);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) navigate('/login/admin');
  }, [user, loading, navigate]);

  const loadAgents = () =>
    api.get('/admin/agents').then((res) => {
      setAgents(res.data.data);
      setError('');
    });

  useEffect(() => {
    if (user?.role === 'admin') loadAgents();
  }, [user]);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    if (formError) setFormError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const errors = runValidators(form, {
      fullName: [v.required('Full name')],
      email: [v.required('Email'), v.email],
      phone: [v.required('Phone'), v.phone],
      password: [v.required('Password')],
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    const passwordError = validatePasswordPolicy(form.password);
    if (passwordError) {
      setFormError(passwordError);
      return;
    }
    if (!/^\d{6}$/.test(form.adminOtp)) {
      setFieldErrors((prev) => ({ ...prev, adminOtp: 'Enter the 6-digit verification code from your email' }));
      return;
    }

    setSubmitting(true);
    try {
      const { adminOtp, ...agentData } = form;
      await api.post('/admin/agents', { ...agentData, adminOtp });
      setShowForm(false);
      setForm({ fullName: '', email: '', phone: '', password: '', adminOtp: '' });
      setFieldErrors({});
      loadAgents();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create Agent');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSuspend = async (Agent: AgentRow) => {
    setUpdatingId(Agent._id);
    setError('');
    try {
      await api.put(`/admin/agents/${Agent._id}`, {
        status: Agent.status === 'active' ? 'suspended' : 'active',
      });
      loadAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update Agent');
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteAgent = async (Agent: AgentRow) => {
    const confirmed = window.confirm(
      `Delete ${Agent.fullName} permanently?\n\nTheir wallet must be empty. Order history will remain.`
    );
    if (!confirmed) return;

    setUpdatingId(Agent._id);
    setError('');
    try {
      await api.delete(`/admin/agents/${Agent._id}`);
      loadAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete Agent');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading || !user) return null;

  return (
    <DashboardLayout role="admin">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Agent Management</h1>
        <Button onClick={() => setShowForm(!showForm)} className="w-full sm:w-auto shrink-0">
          {showForm ? 'Cancel' : 'Add Agent'}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg mb-4">{error}</p>
      )}

      {showForm && (
        <Card className="p-6 mb-6">
          <form noValidate onSubmit={handleCreate} className="grid sm:grid-cols-2 gap-4">
            <Input label="Full Name" value={form.fullName} error={fieldErrors.fullName} onChange={(e) => updateField('fullName', e.target.value)} />
            <Input label="Email" type="email" value={form.email} error={fieldErrors.email} onChange={(e) => updateField('email', e.target.value)} />
            <Input label="Phone" value={form.phone} error={fieldErrors.phone} onChange={(e) => updateField('phone', e.target.value)} />
            <PasswordInput label="Agent password" value={form.password} error={fieldErrors.password} onChange={(e) => updateField('password', e.target.value)} showStrength />
            <AdminPasswordConfirm
              className="sm:col-span-2"
              value={form.adminOtp}
              onChange={(value) => updateField('adminOtp', value)}
              error={fieldErrors.adminOtp}
            />
            <div className="sm:col-span-2 space-y-3">
              <FormAlert message={formError} />
              <Button type="submit" loading={submitting} disabled={submitting} className="w-full sm:w-auto">
                Create Agent
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Wallet</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((d) => {
                const busy = updatingId === d._id;
                const isActive = d.status === 'active';
                return (
                  <tr key={d._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-900 font-medium">{d.fullName}</td>
                    <td className="px-4 py-3 text-gray-700 break-all">{d.email}</td>
                    <td className="px-4 py-3 text-gray-700">{d.phone}</td>
                    <td className="px-4 py-3 text-gray-900 font-semibold tabular-nums">
                      {formatCurrency(d.walletBalance ?? 0)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <ActionChip
                          title="Top up wallet"
                          active
                          activeTone="emerald"
                          disabled={busy}
                          onClick={() =>
                            setTopUpTarget({
                              id: d._id,
                              fullName: d.fullName,
                              balance: d.walletBalance ?? 0,
                            })
                          }
                        >
                          <Wallet className="w-3 h-3" />
                          Top up
                        </ActionChip>

                        <ActionChip
                          title="Send reward"
                          active
                          activeTone="amber"
                          disabled={busy}
                          onClick={() => setRewardTarget({ id: d._id, fullName: d.fullName })}
                        >
                          <Gift className="w-3 h-3" />
                          Reward
                        </ActionChip>

                        <ActionChip
                          title={isActive ? 'Suspend Agent' : 'Activate Agent'}
                          active={isActive}
                          activeTone="emerald"
                          inactiveTone="rose"
                          disabled={busy}
                          onClick={() => toggleSuspend(d)}
                        >
                          {busy ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : isActive ? (
                            <UserX className="w-3 h-3" />
                          ) : (
                            <UserCheck className="w-3 h-3" />
                          )}
                          {isActive ? 'Suspend' : 'Activate'}
                        </ActionChip>

                        <ActionChip
                          title="Delete Agent"
                          active={false}
                          inactiveTone="rose"
                          disabled={busy}
                          onClick={() => deleteAgent(d)}
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </ActionChip>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {topUpTarget && (
        <AdminAgentTopUpModal
          userId={topUpTarget.id}
          fullName={topUpTarget.fullName}
          currentBalance={topUpTarget.balance}
          onClose={() => setTopUpTarget(null)}
          onSuccess={loadAgents}
        />
      )}

      {rewardTarget && (
        <AdminRewardModal
          role="agent"
          userId={rewardTarget.id}
          fullName={rewardTarget.fullName}
          onClose={() => setRewardTarget(null)}
        />
      )}
    </DashboardLayout>
  );
}
