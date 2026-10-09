import React from 'react';

const settingsSections = [
  { title: 'Profile', fields: ['Full name', 'Username', 'Email'] },
  { title: 'Preferences', fields: ['Language', 'Timezone', 'Theme'] },
  { title: 'Notifications', fields: ['Email alerts', 'Push notifications', 'SMS updates'] },
];

export default function UserSettings() {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Account</p>
            <h1 style={styles.title}>Profile settings</h1>
          </div>
          <button style={styles.primaryButton}>Save changes</button>
        </header>

        <div style={styles.content}>
          <aside style={styles.sidebar}>
            <div style={styles.avatarWrap}>
              <div style={styles.avatar}>JD</div>
            </div>
            <h2 style={styles.name}>John Doe</h2>
            <p style={styles.subtitle}>Administrator</p>

            <nav style={styles.nav}>
              {settingsSections.map((section) => (
                <button key={section.title} style={styles.navButton}>
                  {section.title}
                </button>
              ))}
            </nav>
          </aside>

          <main style={styles.mainPanel}>
            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>Personal information</h3>

              <div style={styles.formGrid}>
                <label style={styles.field}>
                  <span style={styles.label}>Full name</span>
                  <input style={styles.input} type="text" defaultValue="John Doe" />
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Username</span>
                  <input style={styles.input} type="text" defaultValue="johndoe" />
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Email address</span>
                  <input style={styles.input} type="email" defaultValue="john@example.com" />
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Phone number</span>
                  <input style={styles.input} type="tel" defaultValue="+1 (555) 123-4567" />
                </label>
              </div>
            </section>

            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>Preferences</h3>

              <div style={styles.formGrid}>
                <label style={styles.field}>
                  <span style={styles.label}>Language</span>
                  <select style={styles.input} defaultValue="en">
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                  </select>
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Timezone</span>
                  <select style={styles.input} defaultValue="utc">
                    <option value="utc">UTC</option>
                    <option value="est">EST</option>
                    <option value="pst">PST</option>
                  </select>
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Theme</span>
                  <select style={styles.input} defaultValue="light">
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="system">System</option>
                  </select>
                </label>
              </div>
            </section>

            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>Security</h3>

              <div style={styles.formGrid}>
                <label style={styles.field}>
                  <span style={styles.label}>Password</span>
                  <input style={styles.input} type="password" defaultValue="********" />
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Two-factor authentication</span>
                  <button type="button" style={styles.secondaryButton}>Enable</button>
                </label>
              </div>
            </section>

            <div style={styles.footerActions}>
              <button type="button" style={styles.secondaryButton}>Cancel</button>
              <button type="button" style={styles.primaryButton}>Update profile</button>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f3f4f6',
    padding: '32px 20px',
    fontFamily: 'Arial, sans-serif',
    color: '#111827',
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    background: '#ffffff',
    borderRadius: '18px',
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '28px 32px',
    borderBottom: '1px solid #e5e7eb',
  },
  eyebrow: {
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontSize: '12px',
    color: '#6b7280',
  },
  title: {
    margin: '8px 0 0',
    fontSize: '32px',
  },
  primaryButton: {
    border: 'none',
    borderRadius: '10px',
    background: '#111827',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 600,
    padding: '12px 18px',
  },
  content: {
    display: 'flex',
    gap: '24px',
    padding: '24px 32px 32px',
  },
  sidebar: {
    width: '280px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    padding: '24px 20px',
    textAlign: 'center',
  },
  avatarWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  avatar: {
    width: '88px',
    height: '88px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #111827, #4b5563)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    fontWeight: 700,
  },
  name: {
    margin: '0 0 6px',
    fontSize: '24px',
  },
  subtitle: {
    margin: 0,
    color: '#6b7280',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '28px',
  },
  navButton: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '12px 14px',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#374151',
  },
  mainPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  section: {
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    padding: '22px',
    background: '#ffffff',
  },
  sectionTitle: {
    margin: '0 0 20px',
    fontSize: '20px',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))',
    gap: '18px 20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontSize: '14px',
    color: '#374151',
  },
  label: {
    fontWeight: 600,
  },
  input: {
    width: '100%',
    border: '1px solid #d1d5db',
    borderRadius: '10px',
    padding: '11px 12px',
    fontSize: '14px',
    background: '#fff',
    color: '#111827',
    boxSizing: 'border-box',
  },
  secondaryButton: {
    border: '1px solid #d1d5db',
    borderRadius: '10px',
    background: '#ffffff',
    color: '#111827',
    cursor: 'pointer',
    fontWeight: 600,
    padding: '12px 18px',
  },
  footerActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    paddingTop: '8px',
  },
};
