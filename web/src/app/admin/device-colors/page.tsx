import DeviceColorManager from '@/components/DeviceColorManager'

export default function DeviceColorsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Gerenciar Cores</h1>
        <p className="text-gray-600 mt-2">
          Cadastre e organize as cores disponíveis para seus produtos
        </p>
      </div>
      <DeviceColorManager />
    </div>
  )
}
