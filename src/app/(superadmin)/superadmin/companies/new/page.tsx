import { CreateCompanyForm } from '@/components/superadmin/create-company-form'

export default function NewCompanyPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Yeni Firma Olustur</h1>
      <CreateCompanyForm />
    </div>
  )
}
