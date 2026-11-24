import { createContext, useContext, useState, type ReactNode } from 'react';
import { CommissionForm } from './CommissionForm';
import { Modal } from './ui';

/** Lets any page (header button, board column, dashboard) open the "New commission" form. */
const Ctx = createContext<(stageId?: string) => void>(() => {});

export function NewCommissionProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [stageId, setStageId] = useState<string>();
  return (
    <Ctx.Provider
      value={(id) => {
        setStageId(id);
        setOpen(true);
      }}
    >
      {children}
      <Modal open={open} onClose={() => setOpen(false)} title="New commission" wide>
        <CommissionForm initialStageId={stageId} onDone={() => setOpen(false)} />
      </Modal>
    </Ctx.Provider>
  );
}

export function useNewCommission() {
  return useContext(Ctx);
}
