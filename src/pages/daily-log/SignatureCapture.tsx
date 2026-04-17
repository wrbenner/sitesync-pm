import React from 'react';
import { SignaturePad } from '../../components/dailylog/SignaturePad';

interface SignatureCaptureProps {
  visible: boolean;
  signerName?: string;
  signerTitle?: string;
  onSign: () => Promise<void> | void;
}

export const SignatureCapture: React.FC<SignatureCaptureProps> = ({ visible, signerName = '', signerTitle = 'Project Manager', onSign }) => {
  if (!visible) return null;
  return (
    <SignaturePad
      signerName={signerName}
      signerTitle={signerTitle}
      onSign={onSign}
    />
  );
};
