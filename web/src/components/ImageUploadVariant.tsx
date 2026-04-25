'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Trash2, Upload, Loader2, X } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

export interface VariantImage {
  id: string
  url: string
  order: number
  createdAt: string
}

interface ImageUploadVariantProps {
  variantId: string
  productId?: string
  onImagesChange?: (images: VariantImage[]) => void
  maxImages?: number
  maxFileSize?: number
}

export default function ImageUploadVariant({
  variantId,
  onImagesChange,
  maxImages = 5,
  maxFileSize = 5 * 1024 * 1024, // 5MB
}: ImageUploadVariantProps) {
  const [images, setImages] = useState<VariantImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadImages = useCallback(async () => {
    try {
      const res = await fetch(`/api/variants/${variantId}/images`)
      const data = await res.json()

      if (res.ok && Array.isArray(data)) {
        setImages(data)
      }
    } catch (err) {
      console.error('Erro ao carregar imagens:', err)
    }
  }, [variantId])

  // Carregar imagens existentes quando o componente monta
  useEffect(() => {
    loadImages()
  }, [loadImages])

  function validateFiles(files: File[]): string | null {
    // Validar quantidade total
    if (images.length + files.length > maxImages) {
      return `Máximo de ${maxImages} imagens permitido. Você tem ${images.length} e está tentando adicionar ${files.length}.`
    }

    // Validar cada arquivo
    for (const file of files) {
      // Validar tipo
      if (!file.type.startsWith('image/')) {
        return `${file.name}: não é uma imagem válida`
      }

      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        return `${file.name}: formato não suportado. Use JPG, PNG ou WebP`
      }

      // Validar tamanho
      if (file.size > maxFileSize) {
        return `${file.name}: arquivo maior que 5MB`
      }
    }

    return null
  }

  async function handleFilesUpload(files: File[]) {
    const validationError = validateFiles(files)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setUploading(true)

    try {
      // Fazer upload de cada arquivo sequencialmente
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch(`/api/variants/${variantId}/images`, {
          method: 'POST',
          body: formData,
        })

        const data = await res.json()

        if (!res.ok) {
          setError(data.error || `Erro ao fazer upload de ${file.name}`)
          // Continua com os próximos arquivos mesmo se um falhar
          continue
        }
      }

      // Recarregar imagens após todos os uploads
      await loadImages()
      onImagesChange?.(images)

      // Limpar input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      console.error('Erro ao fazer upload:', err)
      setError('Erro ao fazer upload de imagens')
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteImage(imageId: string) {
    if (!window.confirm('Tem certeza que deseja remover esta imagem?')) {
      return
    }

    try {
      const res = await fetch(`/api/variants/${variantId}/images/${imageId}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao deletar imagem')
        return
      }

      // Recarregar imagens
      await loadImages()
      onImagesChange?.(images)
      setError(null)
    } catch (err) {
      console.error('Erro ao deletar imagem:', err)
      setError('Erro ao deletar imagem')
    }
  }

  function handleDragEnter(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files)
      handleFilesUpload(files)
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const files = Array.from(e.target.files)
      handleFilesUpload(files)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold mb-2">
          📸 Imagens da Variação ({images.length}/{maxImages})
        </h4>

        {/* Drag & Drop Area */}
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-border bg-muted hover:border-gray-400'
          } ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileInput}
            disabled={uploading}
            className="hidden"
          />

          <div className="flex flex-col items-center gap-2">
            {uploading ? (
              <>
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-sm text-muted-foreground">Fazendo upload...</p>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-muted-foreground" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium">Arraste imagens aqui ou clique para selecionar</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Máximo: {maxImages} imagens, até 5MB cada
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Formatos: JPG, PNG, WebP
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  📁 Selecionar Imagens
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Image Preview Grid */}
        {images.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Imagens Carregadas:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {images.map((image) => (
                <div
                  key={image.id}
                  className="relative group aspect-square bg-muted rounded-lg overflow-hidden border border-border"
                >
                  {/* Imagem */}
                  <Image
                    src={image.url}
                    alt={`Imagem ${image.order}`}
                    fill
                    className="w-full h-full object-cover"
                  />

                  {/* Overlay com número de ordem */}
                  <div className="absolute top-1 left-1 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                    {image.order}
                  </div>

                  {/* Botão delete (aparece no hover) */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(image.id)}
                      className="bg-red-600 hover:bg-red-700 text-white rounded-full p-2 transition-colors"
                      title="Remover imagem"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {images.length === 0 && !error && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded text-center text-sm text-blue-700">
            Nenhuma imagem carregada ainda. Adicione imagens para esta variação.
          </div>
        )}
      </div>
    </div>
  )
}
