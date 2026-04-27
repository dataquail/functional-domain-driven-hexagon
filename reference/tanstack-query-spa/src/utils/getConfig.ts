export const getConfig = () => {
  type Environment = 'development';
  const environment: Environment = 'development';

  const configMap = {
    development: {
      API_HOST: 'localhost:3333/api',
      API_URL: 'http://localhost:3333/api',
    },
  };

  return configMap[environment];
};
