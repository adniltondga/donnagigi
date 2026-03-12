import DeviceModelManager from '@/components/DeviceModelManager'

export default function DeviceModelsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Gerenciar Modelos de Dispositivo</h1>
        <p className="text-gray-600 mt-2">
          Cadastre modelos (ex: iPhone 14 Pro Max) e associe as cores disponíveis
        </p>
      </div>
      <DeviceModelManager />
    </div>
  )
}
