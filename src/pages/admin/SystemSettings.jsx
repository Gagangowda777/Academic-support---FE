import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';

const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const STATUS_LABELS = {
  not_configured: 'Not configured',
  unverified: 'Needs verification',
  connected: 'Connected',
  error: 'Connection error',
  disabled: 'Disabled',
};

function statusTone(status) {
  if (status === 'connected') return 'ad-badge--good';
  if (status === 'error') return 'ad-badge--bad';
  if (status === 'disabled') return 'ad-badge--off';
  if (status === 'unverified') return 'ad-badge--warn';
  return '';
}

function formatDate(value) {
  return value ? dateTimeFormat.format(new Date(value)) : 'Never';
}

function formFrom(integration) {
  return {
    endpoint: integration.endpoint || '',
    enabled: Boolean(integration.enabled),
    syncFrequencyMinutes: integration.syncFrequencyMinutes || 60,
    notes: integration.notes || '',
  };
}

export default function SystemSettings() {
  const [data, setData] = useState(null);
  const [forms, setForms] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState({});

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await api.adminSystem();
      setData(response);
      setForms(
        Object.fromEntries(
          response.integrations.map((integration) => [integration.key, formFrom(integration)])
        )
      );
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateForm(key, field, value) {
    setForms((current) => ({
      ...current,
      [key]: { ...current[key], [field]: value },
    }));
  }

  function applyIntegration(integration) {
    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        integrations: current.integrations.map((item) =>
          item.key === integration.key ? integration : item
        ),
      };
    });
    setForms((current) => ({
      ...current,
      [integration.key]: formFrom(integration),
    }));
  }

  async function saveIntegration(key) {
    const form = forms[key];
    if (!form) return;

    setBusy((current) => ({ ...current, [key]: 'save' }));
    setError('');
    setNotice('');
    try {
      const response = await api.adminUpdateIntegration(key, {
        endpoint: form.endpoint,
        enabled: form.enabled,
        syncFrequencyMinutes: Number(form.syncFrequencyMinutes),
        notes: form.notes,
      });
      applyIntegration(response.integration);
      setNotice(response.message);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy((current) => ({ ...current, [key]: '' }));
    }
  }

  async function testIntegration(key) {
    setBusy((current) => ({ ...current, [key]: 'test' }));
    setError('');
    setNotice('');
    try {
      const response = await api.adminTestIntegration(key);
      applyIntegration(response.integration);
      setNotice(response.detail ? `${response.message} ${response.detail}` : response.message);
    } catch (testError) {
      setError(testError.message);
    } finally {
      setBusy((current) => ({ ...current, [key]: '' }));
    }
  }

  const integrations = data?.integrations || [];
  const master = data?.masterData || {};
  const connected = useMemo(
    () => integrations.filter((integration) => integration.status === 'connected').length,
    [integrations]
  );
  const enabled = useMemo(
    () => integrations.filter((integration) => integration.enabled).length,
    [integrations]
  );
  const lastChecked = useMemo(() => {
    const stamps = integrations
      .map((integration) => integration.lastCheckedAt)
      .filter(Boolean)
      .map((value) => new Date(value).getTime());
    return stamps.length ? new Date(Math.max(...stamps)).toISOString() : null;
  }, [integrations]);

  if (loading) {
    return (
      <div className="sd__state">
        <span className="spinner" aria-label="Loading system settings" />
        <p className="ad-viewloading">Loading integrations and master-data health…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <section className="sd-panel">
        <div className="sd-empty">
          <p className="sd-empty__title">System settings could not load</p>
          <p className="sd-empty__text">{error}</p>
          <button type="button" className="ad-primary" onClick={load}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      {notice ? (
        <div className="sd-alert sd-alert--good ad-alert" role="status">
          <span>{notice}</span>
          <button type="button" className="ad-alert__retry" onClick={() => setNotice('')}>
            Dismiss
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="sd-alert ad-alert" role="alert">
          <span>{error}</span>
        </div>
      ) : null}

      <section className="sd-summary" aria-label="Integration health">
        <article className="sd-summary__card">
          <span className="sd-summary__label">Connected systems</span>
          <strong className="sd-summary__value">
            {connected}<span className="ad-slash">/</span>{integrations.length}
          </strong>
          <span className="sd-summary__hint">{enabled} enabled for synchronisation</span>
        </article>
        <article className="sd-summary__card">
          <span className="sd-summary__label">Student master records</span>
          <strong className="sd-summary__value">{master.students ?? 0}</strong>
          <span className="sd-summary__hint">active student accounts</span>
        </article>
        <article className="sd-summary__card">
          <span className="sd-summary__label">Faculty master records</span>
          <strong className="sd-summary__value">{master.faculty ?? 0}</strong>
          <span className="sd-summary__hint">active faculty accounts</span>
        </article>
        <article className="sd-summary__card">
          <span className="sd-summary__label">Last connection check</span>
          <strong className="sd-summary__value ad-summary__value--text">
            {formatDate(lastChecked)}
          </strong>
          <span className="sd-summary__hint">
            {master.subjects ?? 0} subjects · {master.departments ?? 0} departments
          </span>
        </article>
      </section>

      <section className="sd-panel">
        <div className="sd-panel__head">
          <div className="sd-panel__titlewrap">
            <h2 className="sd-panel__title">ERP / SIS master data connections</h2>
          </div>
          <span className="sd-panel__hint">Super admin only</span>
        </div>
        <p className="ov-note ad-manage-intro">
          Store the endpoint and sync cadence for each institutional source. Connection checks call
          the configured endpoint directly; status and errors are persisted for monitoring.
        </p>

        <div className="ad-integrations">
          {integrations.map((integration) => {
            const form = forms[integration.key] || formFrom(integration);
            const mode = busy[integration.key];
            const endpointHost = (() => {
              try {
                return new URL(integration.endpoint).host;
              } catch {
                return '';
              }
            })();

            return (
              <article className="ad-integration" key={integration.key}>
                <div className="ad-integration__head">
                  <div>
                    <div className="ad-integration__title">
                      <h3>{integration.name}</h3>
                      <span className={`ad-badge ${statusTone(integration.status)}`}>
                        {STATUS_LABELS[integration.status] || integration.status}
                      </span>
                    </div>
                    <p>{integration.description}</p>
                  </div>
                  <span className="ad-integration__key">{integration.key.toUpperCase()}</span>
                </div>

                <div className="ad-form__grid ad-integration__form">
                  <label className="sd-field ad-form__wide">
                    <span className="field-label">Endpoint URL</span>
                    <input
                      className="text-input"
                      type="url"
                      value={form.endpoint}
                      onChange={(event) =>
                        updateForm(integration.key, 'endpoint', event.target.value)
                      }
                      placeholder="https://erp.example.edu/api/health"
                      maxLength={500}
                    />
                    <span className="ad-field-note">
                      {endpointHost
                        ? `Monitoring ${endpointHost} with an HTTP HEAD request.`
                        : 'Use the health or master-data endpoint provided by the vendor.'}
                    </span>
                  </label>
                  <label className="sd-field">
                    <span className="field-label">Sync frequency (minutes)</span>
                    <input
                      className="text-input"
                      type="number"
                      min="5"
                      max="10080"
                      value={form.syncFrequencyMinutes}
                      onChange={(event) =>
                        updateForm(
                          integration.key,
                          'syncFrequencyMinutes',
                          event.target.value
                        )
                      }
                    />
                  </label>
                  <label className="ad-check ad-form__wide">
                    <input
                      type="checkbox"
                      checked={form.enabled}
                      onChange={(event) =>
                        updateForm(integration.key, 'enabled', event.target.checked)
                      }
                    />
                    <span>
                      <strong>Enable scheduled synchronisation</strong>
                      <small>
                        An endpoint is required before this connection can be enabled.
                      </small>
                    </span>
                  </label>
                  <label className="sd-field ad-form__wide">
                    <span className="field-label">Notes</span>
                    <textarea
                      className="text-input ad-textarea"
                      rows={2}
                      value={form.notes}
                      onChange={(event) =>
                        updateForm(integration.key, 'notes', event.target.value)
                      }
                      placeholder="Owner, credential rotation, field mapping or vendor contact…"
                      maxLength={1000}
                    />
                  </label>
                </div>

                <div className="ad-integration__monitor">
                  <div>
                    <span>Last checked</span>
                    <strong>{formatDate(integration.lastCheckedAt)}</strong>
                  </div>
                  <div>
                    <span>Master records</span>
                    <strong>
                      {master.students ?? 0} students · {master.faculty ?? 0} faculty
                    </strong>
                  </div>
                  <div>
                    <span>Last saved</span>
                    <strong>{formatDate(integration.updatedAt)}</strong>
                  </div>
                </div>

                {integration.lastError ? (
                  <div className="ad-integration__error" role="status">
                    {integration.lastError}
                  </div>
                ) : null}

                <div className="ad-form__actions ad-integration__actions">
                  <button
                    type="button"
                    className="sd-download"
                    onClick={() => testIntegration(integration.key)}
                    disabled={Boolean(mode) || !integration.endpoint}
                  >
                    {mode === 'test' ? 'Testing…' : 'Test connection'}
                  </button>
                  <button
                    type="button"
                    className="ad-primary"
                    onClick={() => saveIntegration(integration.key)}
                    disabled={Boolean(mode)}
                  >
                    {mode === 'save' ? 'Saving…' : 'Save configuration'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="sd-panel">
        <div className="sd-panel__head">
          <div className="sd-panel__titlewrap">
            <h2 className="sd-panel__title">Master data snapshot</h2>
          </div>
          <span className="sd-panel__hint">Current institution records</span>
        </div>
        <dl className="ad-metrics ad-metrics--wide">
          <div>
            <dt>Students</dt>
            <dd>{master.students ?? 0}</dd>
          </div>
          <div>
            <dt>Faculty</dt>
            <dd>{master.faculty ?? 0}</dd>
          </div>
          <div>
            <dt>Subjects</dt>
            <dd>{master.subjects ?? 0}</dd>
          </div>
          <div>
            <dt>Departments</dt>
            <dd>{master.departments ?? 0}</dd>
          </div>
        </dl>
        <p className="ov-note">
          Connection tests only verify that the configured endpoint responds. Credential handling
          and field-level reconciliation remain the responsibility of the ERP/SIS integration
          owner.
        </p>
      </section>
    </>
  );
}
