import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useEffectAsync } from '@fyclabs/tools-fyc-react/utils';
import { $forms } from '@src/signals';
import { loadForms } from './_helpers/formsManager.events';
import {
  FormsManagerTable,
  FormEditModal,
  FormEmbedModal,
} from './components/FormsManager';

function FormsManager({ eventId, tickets, upsellings, discounts, onUpdate }) {
  const forms = $forms.value.list;

  useEffectAsync(async () => {
    await loadForms(eventId);
  }, [eventId]);

  return (
    <DndProvider backend={HTML5Backend}>
      <FormsManagerTable eventId={eventId} forms={forms} />
      <FormEditModal
        eventId={eventId}
        tickets={tickets}
        upsellings={upsellings}
        discounts={discounts}
        onUpdate={onUpdate}
      />
      <FormEmbedModal />
    </DndProvider>
  );
}

export default FormsManager;
