"use client";

import Modal from "@/components/Modal";
import UploadBox from "@/components/UploadBox";

export default function UploaderModal({ tool, onClose }) {
  return (
    <Modal title={tool.name} onClose={onClose}>
      <UploadBox defaultExpiry="24h" />
    </Modal>
  );
}
