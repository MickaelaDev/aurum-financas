import { useEffect, useState } from 'react';
import { useApp } from '../state/AppContext';
import { saveCategory } from '../lib/repo';
import type { Category } from '../lib/types';
import {
  Button,
  ColorPicker,
  Field,
  Input,
  Modal,
  Select,
  useToast,
} from './ui';

export function CategoryModal({
  open,
  onClose,
  category,
  defaultKind = 'expense',
}: {
  open: boolean;
  onClose: () => void;
  category?: Category | null;
  defaultKind?: Category['kind'];
}) {
  const { db, bump } = useApp();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Category['kind']>(defaultKind);
  const [color, setColor] = useState('#c9a86a');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setName(category?.name ?? '');
    setKind(category?.kind ?? defaultKind);
    setColor(category?.color ?? '#c9a86a');
  }, [open, category, defaultKind]);

  function submit() {
    if (!name.trim()) {
      setError('Dê um nome para a categoria.');
      return;
    }
    saveCategory(db, {
      id: category?.id,
      name,
      kind,
      color,
      archived: category?.archived,
    });
    bump();
    toast(category ? 'Categoria atualizada.' : 'Categoria criada.');
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={category ? 'Editar categoria' : 'Nova categoria'}
      title={category ? 'Ajustar categoria' : 'Adicionar categoria'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit}>{category ? 'Salvar' : 'Criar'}</Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Nome" error={error} htmlFor="category-name" className="span-2">
          <Input
            id="category-name"
            value={name}
            onChange={(event) => setName(event.target.value.slice(0, 40))}
            placeholder="Ex.: Pets, Viagens"
            autoFocus
          />
        </Field>
        <Field label="Tipo" htmlFor="category-kind" className="span-2">
          <Select
            id="category-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as Category['kind'])}
          >
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
          </Select>
        </Field>
        <Field label="Cor" className="span-2">
          <ColorPicker value={color} onChange={setColor} />
        </Field>
      </div>
    </Modal>
  );
}
