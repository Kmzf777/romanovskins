import { getCurrentUser } from '@/server/auth-actions';
import HeaderContent from './HeaderContent';

export default async function Header() {
    const user = await getCurrentUser();

    return <HeaderContent user={user} />;
}
