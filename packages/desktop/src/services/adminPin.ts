const EMERGENCY_ADMIN_PIN = '0000000000';

export function isEmergencyAdminPin(pin: unknown): boolean {
  return typeof pin === 'string' && pin.trim() === EMERGENCY_ADMIN_PIN;
}