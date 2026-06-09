import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PasswordInput from '@/components/ui/PasswordInput';
import { getPasswordStrength } from '@/lib/password-strength';
import FormAlert from '@/components/ui/FormAlert';
import { runValidators, v } from '@/lib/form-validation';
import { useNavigate } from 'react-router-dom';

export default function AdminDealersPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [dealers, setDealers] = useState<Array<Record<string, unknown>>>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) navigate('/login/admin');
  }, [user, loading, navigate]);

  const loadDealers = () => api.get('/admin/dealers').then((res) => setDealers(res.data.data));

  useEffect(() => { if (user?.role === 'admin') loadDealers(); }, [user]);

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

    const strength = getPasswordStrength(form.password);
    if (strength.level === 'weak' || strength.level === 'fair') {
      setFormError('Choose a stronger password with uppercase, lowercase, numbers, and symbols.');
      return;
    }
    await api.post('/admin/dealers', form);
    setShowForm(false);
    setForm({ fullName: '', email: '', phone: '', password: '' });
    loadDealers();
  };

  const toggleSuspend = async (id: string, status: string) => {
    await api.put(`/admin/dealers/${id}`, { status: status === 'active' ? 'suspended' : 'active' });
    loadDealers();
  };

  if (loading || !user) return null;

  return (
    <DashboardLayout role="admin">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Dealer Management</h1>
        <Button onClick={() => setShowForm(!showForm)} className="w-full sm:w-auto shrink-0">{showForm ? 'Cancel' : 'Add Dealer'}</Button>
      </div>

      {showForm && (
        <Card className="p-6 mb-6">
          <form noValidate onSubmit={handleCreate} className="grid sm:grid-cols-2 gap-4">
            <Input label="Full Name" value={form.fullName} error={fieldErrors.fullName} onChange={(e) => updateField('fullName', e.target.value)} />
            <Input label="Email" type="email" value={form.email} error={fieldErrors.email} onChange={(e) => updateField('email', e.target.value)} />
            <Input label="Phone" value={form.phone} error={fieldErrors.phone} onChange={(e) => updateField('phone', e.target.value)} />
            <PasswordInput label="Password" value={form.password} error={fieldErrors.password} onChange={(e) => updateField('password', e.target.value)} showStrength />
            <div className="sm:col-span-2 space-y-3">
              <FormAlert message={formError} />
              <Button type="submit" className="w-full sm:w-auto">Create Dealer</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dealers.map((d) => (
                <tr key={d._id as string} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-gray-900">{d.fullName as string}</td>
                  <td className="px-4 py-3 text-gray-700 break-all">{d.email as string}</td>
                  <td className="px-4 py-3 text-gray-700">{d.phone as string}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${d.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {d.status as string}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="outline" onClick={() => toggleSuspend(d._id as string, d.status as string)}>
                      {d.status === 'active' ? 'Suspend' : 'Activate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </DashboardLayout>
  );
}
