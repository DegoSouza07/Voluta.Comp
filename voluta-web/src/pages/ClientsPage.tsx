import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/Layout';
import { Modal } from '../components/Modal';
import { Button, Card, ErrorBanner, Field, TextInput } from '../components/ui';
import { ApiError, clientsApi, type Client } from '../lib/api';
import s from './shared.module.css';

export function ClientsPage() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loadError, setLoadError] = useState('');
  function reload() {
    clientsApi
      .list()
      .then(setClients)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Falha ao carregar clientes.'));
  }

  async function handleDeleteClient(id: string, name: string) {
    if (
      !window.confirm(
        `Remover "${name}" da lista de clientes? Os projetos já criados não são apagados — o cliente só some da listagem, e isso é reversível.`,
      )
    )
      return;
    try {
      await clientsApi.deactivate(id);
      reload();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Não foi possível remover o cliente.');
    }
  }
  
  useEffect(reload, []);

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="As marcas atendidas pela Voluta."
        action={<Button onClick={() => setShowCreate(true)}>+ Novo cliente</Button>}
      />

      <ErrorBanner>{loadError}</ErrorBanner>

      {clients === null && !loadError && <p className={s.loadingLine}>Carregando...</p>}

      {clients?.length === 0 && (
        <div className={s.emptyState}>
          <h3>Nenhum cliente ainda</h3>
          <p>Cadastre a primeira marca pra começar a montar um Plano Visual.</p>
          <Button onClick={() => setShowCreate(true)}>+ Novo cliente</Button>
        </div>
      )}

      {clients && clients.length > 0 && (
        <div className={s.grid}>
          {clients.map((client) => (
            <div key={client.id} className={s.cardWrapper}>
              <Link to={`/clients/${client.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Card hover>
                  <div className={s.itemTitle}>{client.name}</div>
                  <div className={s.itemMeta}>@{client.instagramHandle ?? client.slug}</div>
                </Card>
              </Link>
              <button
                type="button"
                className={s.cardDeleteButton}
                title="Excluir cliente"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDeleteClient(client.id, client.name);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateClientModal onClose={() => setShowCreate(false)} onCreated={reload} />}
    </div>
  );
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function CreateClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [websiteLabel, setWebsiteLabel] = useState('');
  const [toneOfVoice, setToneOfVoice] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await clientsApi.create({
        name,
        slug: slugify(name),
        instagramHandle: instagramHandle || undefined,
        websiteLabel: websiteLabel || undefined,
        toneOfVoice: toneOfVoice || undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar o cliente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Novo cliente" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <ErrorBanner>{error}</ErrorBanner>

        <Field label="Nome da marca">
          <TextInput required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Casa Pla" />
        </Field>

        <Field label="Instagram" hint="Sem o @">
          <TextInput value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} placeholder="casapla" />
        </Field>

        <Field label="Site" hint="Como aparece no rodapé do plano visual">
          <TextInput value={websiteLabel} onChange={(e) => setWebsiteLabel(e.target.value)} placeholder="casapla.com.br" />
        </Field>

        <Field label="Tom de voz" hint="Usado pela IA ao sugerir legendas">
          <TextInput
            value={toneOfVoice}
            onChange={(e) => setToneOfVoice(e.target.value)}
            placeholder="Caloroso, editorial, primeira pessoa"
          />
        </Field>

        <div className={s.modalActions}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting || !name}>
            {submitting ? 'Criando...' : 'Criar cliente'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
