export const dashboardRouteForRole = (role?: string) => {
  const routes: Record<string, string> = {
    admin: '/admin',
    dealer: '/dealer',
    reseller: '/reseller',
  };
  return routes[role || ''] || '/';
};
