import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ProfileForm } from '../components/ProfileForm';
import { StageEditor } from '../components/StageEditor';
import { Card, PageHeader } from '../components/ui';
import { useBusiness, useMe } from '../lib/queries';

export function Settings() {
  const business = useBusiness();
  const { data } = useMe();
  const { hash } = useLocation();

  // Jump to a section when linked as /settings#stages.
  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' });
  }, [hash]);

  return (
    <div className="space-y-10">
      <PageHeader title="Settings" subtitle={`Signed in as ${data?.user.email}`} />
      <section>
        <h2 className="display mb-3 text-3xl">Business profile</h2>
        <Card className="p-5 sm:p-6">
          <ProfileForm business={business} />
        </Card>
      </section>
      <section id="stages">
        <h2 className="display text-3xl">Stages</h2>
        <p className="mb-3 text-sm text-muted">The columns on your stage board. Rename them to match how you work.</p>
        <Card className="p-5 sm:p-6">
          <StageEditor business={business} />
        </Card>
      </section>
    </div>
  );
}
