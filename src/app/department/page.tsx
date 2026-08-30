import { redirect } from 'next/navigation';

export default function DepartmentRoot() {
  redirect('/department/dashboard');
}