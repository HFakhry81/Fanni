// src/utils/addressHelpers.ts

export interface DetailedAddress {
  street: string;
  building: string;
  floor: string;
  apartment: string;
}

/**
 * دمج الحقول التفصيلية في نص واحد منسق للحفظ بالسيرفر
 */
export const serializeAddress = ({ street, building, floor, apartment }: DetailedAddress): string => {
  return [
    street.trim(),
    building ? `Bldg: ${building.trim()}` : '',
    floor ? `Flr: ${floor.trim()}` : '',
    apartment ? `Apt: ${apartment.trim()}` : ''
  ].filter(Boolean).join(', ');
};

/**
 * تفكيك النص المسترجع من السيرفر لتوزيعه على حقول الواجهة
 */
export const deserializeAddress = (addressString: string): DetailedAddress => {
  const result = { street: '', building: '', floor: '', apartment: '' };
  if (!addressString) return result;

  const parts = addressString.split(', ');
  result.street = parts[0] || '';
  
  parts.forEach(part => {
    if (part.startsWith('Bldg: ')) result.building = part.replace('Bldg: ', '');
    if (part.startsWith('Flr: ')) result.floor = part.replace('Flr: ', '');
    if (part.startsWith('Apt: ')) result.apartment = part.replace('Apt: ', '');
  });
  
  return result;
};