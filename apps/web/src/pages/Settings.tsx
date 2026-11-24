import { ProfileForm } from '../components/ProfileForm';
import { Card, PageHeader } from '../components/ui';
import { useBusiness, useMe } from '../lib/queries';

export function Settings() {
  const business = useBusiness();
  const { data } = useMe();

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" subtitle={`Signed in as ${data?.user.email}`} />
      <section>
        <h2 className="display mb-3 text-3xl">Business profile</h2>
        <Card className="p-5 sm:p-6">
          <ProfileForm business={business} />
        </Card>
      </section>
    </div>
  );
}
