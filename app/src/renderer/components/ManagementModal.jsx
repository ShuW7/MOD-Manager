import React from "react";
import { Modal } from "./Modal.jsx";
export function ManagementModal({ onBackdropClose, contentStyle, children }) {
  return (
    <Modal open={true} onClose={onBackdropClose} contentStyle={contentStyle}>
      {children}
    </Modal>
  );
}
