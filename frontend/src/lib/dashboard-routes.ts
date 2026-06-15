export const dashboardRouteForRole = (role?: string) => {
  const routes: Record<string, string> = {
    admin: '/admin',
    agent: '/agent',
    reseller: '/reseller',
  };
  return routes[role || ''] || '/';
};
