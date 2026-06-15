type AlertTone = 'amber' | 'sky' | 'rose' | 'emerald' | 'orange';

export function buildOrderAlerts(
  stats: Record<string, number>,
  ordersLink?: string
): Array<{ title: string; message: string; tone: AlertTone; href?: string }> {
  const alerts: Array<{ title: string; message: string; tone: AlertTone; href?: string }> = [];
  const pending = Number(stats.pendingOrders) || 0;
  const processing = Number(stats.processingOrders) || 0;
  const failed = Number(stats.failedOrders) || 0;
  const notDelivered = Number(stats.notDeliveredOrders) || 0;
  const awaitingBalance = Number(stats.awaitingProviderBalance) || 0;
  const submittingToApi = Number(stats.submittingToApi) || 0;

  if (awaitingBalance > 0) {
    alerts.push({
      title: 'Awaiting Provider Balance',
      message: `${awaitingBalance} order${awaitingBalance === 1 ? '' : 's'} queued — processing will resume shortly.`,
      tone: 'orange',
      href: ordersLink,
    });
  }
  if (submittingToApi > 0) {
    alerts.push({
      title: 'Submitting to API',
      message: `${submittingToApi} order${submittingToApi === 1 ? '' : 's'} being sent to the network.`,
      tone: 'sky',
      href: ordersLink,
    });
  }
  if (pending > 0) {
    alerts.push({
      title: 'Pending Orders',
      message: `${pending} order${pending === 1 ? '' : 's'} awaiting processing.`,
      tone: 'amber',
      href: ordersLink,
    });
  }
  if (processing > 0) {
    alerts.push({
      title: 'Processing Orders',
      message: `${processing} order${processing === 1 ? '' : 's'} currently being processed.`,
      tone: 'sky',
      href: ordersLink,
    });
  }
  if (failed > 0) {
    alerts.push({
      title: 'Failed Orders',
      message: `${failed} order${failed === 1 ? '' : 's'} could not be delivered.`,
      tone: 'rose',
      href: ordersLink,
    });
  }
  if (notDelivered > 0 && failed === 0) {
    alerts.push({
      title: 'Not Delivered',
      message: `${notDelivered} order${notDelivered === 1 ? '' : 's'} were not delivered.`,
      tone: 'rose',
      href: ordersLink,
    });
  }

  return alerts;
}
