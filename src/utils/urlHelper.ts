/**
 * Utilitário para gerenciar URLs de produção e desenvolvimento
 */

export const getBaseUrl = (): string => {
  // Verificar se está em produção
  const isProduction = window.location.hostname === 'supplyart.odontoart.com';
  
  if (isProduction) {
    return 'https://supplyart.odontoart.com';
  }
  
  // Em desenvolvimento, usar a URL atual
  return window.location.origin;
};

export const getPasswordResetUrl = (): string => {
  return `${getBaseUrl()}/reset-password`;
};

export const isProductionEnvironment = (): boolean => {
  return window.location.hostname === 'supplyart.odontoart.com';
};

export const getEnvironmentInfo = () => {
  const isProduction = isProductionEnvironment();
  return {
    isProduction,
    baseUrl: getBaseUrl(),
    hostname: window.location.hostname,
    environment: isProduction ? 'production' : 'development'
  };
};