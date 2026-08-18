let emergencyServerModule = null;

export const getEmergencyServer = () => {
  if (!emergencyServerModule) {
    emergencyServerModule = require('./EmergencyServer').default;
  }
  return emergencyServerModule;
};
