import React from 'react';
import { ShipmentQrPayload } from '../utils/shipmentQrCode.ts';

export interface ShipmentQrBadgeProps {
  shipment: ShipmentQrPayload;
  onOpenInSystem?: (invoiceNumber: string, shippingMark?: string) => void;
  showInteractiveControls?: boolean;
  inlineStylesOnly?: boolean;
  testIdPrefix?: string;
}

export const ShipmentQrBadge: React.FC<ShipmentQrBadgeProps> = () => {
  return null;
};

