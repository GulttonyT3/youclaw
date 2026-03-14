import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useI18n } from "@/i18n"
import { cn } from "@/lib/utils"
import { Plus, Pencil, Trash2, Check, Zap, Settings2 } from "lucide-react"
import { getSettings, updateSettings, type SettingsDTO, type CustomModelDTO } from "@/api/client"

// 内置模型定义
const BUILTIN_MODELS = [
  {
    id: "youclaw-pro",
    name: "YouClaw Pro",
    description: "Most capable built-in model",
    modelId: "claude-sonnet-4-6",
  },
] as const

interface ActiveModel {
  provider: "builtin" | "custom"
  id?: string
}

export function ModelsPanel() {
  const { t } = useI18n()
  const [builtinModel, setBuiltinModel] = useState("youclaw-pro")
  const [customModels, setCustomModels] = useState<CustomModelDTO[]>([])
  const [activeModel, setActiveModel] = useState<ActiveModel>({ provider: "builtin" })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<CustomModelDTO | null>(null)
  // 表单字段
  const [formName, setFormName] = useState("")
  const [formModelId, setFormModelId] = useState("")
  const [formApiKey, setFormApiKey] = useState("")
  const [formBaseUrl, setFormBaseUrl] = useState("")
  // 表单校验错误（字段被 touch 后才展示）
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // 从后端 API 加载
  useEffect(() => {
    getSettings().then((settings) => {
      setActiveModel(settings.activeModel)
      setCustomModels(settings.customModels)
    }).catch(console.error)
  }, [])

  // 保存到后端
  const saveSettings = useCallback(async (partial: Partial<SettingsDTO>) => {
    try {
      const updated = await updateSettings(partial)
      setActiveModel(updated.activeModel)
      setCustomModels(updated.customModels)
    } catch (err) {
      console.error('Failed to save settings:', err)
    }
  }, [])

  // 切换 active provider
  const handleSetActiveProvider = async (provider: "builtin" | "custom") => {
    let newActive: ActiveModel
    if (provider === "builtin") {
      newActive = { provider: "builtin" }
    } else {
      const defaultModel = customModels[0]
      if (!defaultModel) return
      newActive = { provider: "custom", id: defaultModel.id }
    }
    setActiveModel(newActive)
    await saveSettings({ activeModel: newActive })
  }

  // 选择内置模型
  const handleSelectBuiltin = async (id: string) => {
    setBuiltinModel(id)
  }

  // 设置自定义模型为激活
  const handleSetCustomActive = async (id: string) => {
    const newActive: ActiveModel = { provider: "custom", id }
    setActiveModel(newActive)
    await saveSettings({ activeModel: newActive })
  }

  // 表单校验
  const formErrors = {
    name: !formName.trim() ? t.settings.validationRequired ?? 'Required' : null,
    modelId: !formModelId.trim()
      ? t.settings.validationRequired ?? 'Required'
      : /\s/.test(formModelId.trim())
        ? t.settings.validationModelIdNoSpaces ?? 'Model ID cannot contain spaces'
        : null,
    apiKey: !editingModel && !formApiKey.trim()
      ? t.settings.validationRequired ?? 'Required'
      : formApiKey.trim() && formApiKey.trim().length < 8
        ? t.settings.validationApiKeyTooShort ?? 'API Key is too short'
        : null,
    baseUrl: formBaseUrl.trim() && !/^https?:\/\/.+/.test(formBaseUrl.trim())
      ? t.settings.validationBaseUrlFormat ?? 'Must start with http:// or https://'
      : null,
  }
  const hasErrors = Object.values(formErrors).some((e) => e !== null)

  const handleBlur = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }))

  // 打开添加 dialog
  const handleOpenAdd = () => {
    setEditingModel(null)
    setFormName("")
    setFormModelId("")
    setFormApiKey("")
    setFormBaseUrl("")
    setTouched({})
    setDialogOpen(true)
  }

  // 打开编辑 dialog
  const handleOpenEdit = (model: CustomModelDTO) => {
    setEditingModel(model)
    setFormName(model.name)
    setFormModelId(model.modelId)
    setFormApiKey("")
    setFormBaseUrl(model.baseUrl)
    setTouched({})
    setDialogOpen(true)
  }

  // 保存自定义模型（新建或编辑）
  const handleSaveModel = async () => {
    // 标记所有字段为已触碰，显示全部错误
    setTouched({ name: true, modelId: true, apiKey: true, baseUrl: true })
    if (hasErrors) return

    let updated: CustomModelDTO[]
    if (editingModel) {
      updated = customModels.map((m) =>
        m.id === editingModel.id
          ? {
              ...m,
              name: formName,
              modelId: formModelId,
              baseUrl: formBaseUrl,
              provider: 'anthropic' as const,
              // 如果用户输入了新的 apiKey 就用新的，否则保留原值（脱敏值会被后端忽略）
              ...(formApiKey.trim() ? { apiKey: formApiKey } : {}),
            }
          : m
      )
    } else {
      const newModel: CustomModelDTO = {
        id: crypto.randomUUID(),
        name: formName,
        provider: 'anthropic',
        modelId: formModelId,
        apiKey: formApiKey,
        baseUrl: formBaseUrl,
      }
      updated = [...customModels, newModel]
    }
    setCustomModels(updated)
    await saveSettings({ customModels: updated })
    setDialogOpen(false)
  }

  // 删除自定义模型
  const handleDeleteModel = async (id: string) => {
    if (!confirm(t.settings.confirmDeleteModel)) return
    const updated = customModels.filter((m) => m.id !== id)
    setCustomModels(updated)

    const partial: Partial<SettingsDTO> = { customModels: updated }
    // 如果删的是当前激活的，切回内置
    if (activeModel.provider === "custom" && activeModel.id === id) {
      const newActive: ActiveModel = { provider: "builtin" }
      setActiveModel(newActive)
      partial.activeModel = newActive
    }
    await saveSettings(partial)
  }

  // 判断当前模型是否激活
  const isCustomActive = (id: string) => activeModel.provider === "custom" && activeModel.id === id

  return (
    <div className="pt-4 space-y-6">
      {/* Active Model 区 */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
          {t.settings.activeModel}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {/* 内置模型卡片 */}
          <button
            onClick={() => handleSetActiveProvider("builtin")}
            className={cn(
              "relative flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all",
              activeModel.provider === "builtin"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/30"
            )}
          >
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Zap size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{t.settings.builtinProvider}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t.settings.builtinDesc}</div>
            </div>
            {activeModel.provider === "builtin" && (
              <span className="absolute top-3 right-3 flex items-center gap-1 text-xs font-medium text-primary">
                <Check size={12} />
                {t.settings.currentSelection}
              </span>
            )}
          </button>

          {/* 自定义 API 卡片 */}
          <button
            onClick={() => handleSetActiveProvider("custom")}
            className={cn(
              "relative flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all",
              activeModel.provider === "custom"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/30",
              customModels.length === 0 && "opacity-50 cursor-not-allowed"
            )}
            disabled={customModels.length === 0}
          >
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
              <Settings2 size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{t.settings.customProvider}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t.settings.customDesc}</div>
            </div>
            {activeModel.provider === "custom" && (
              <span className="absolute top-3 right-3 flex items-center gap-1 text-xs font-medium text-primary">
                <Check size={12} />
                {t.settings.currentSelection}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 内置模型列表 */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
          {t.settings.builtinModels}
        </h3>
        <div className="space-y-1.5">
          {BUILTIN_MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => handleSelectBuiltin(model.id)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors",
                builtinModel === model.id
                  ? "bg-accent"
                  : "hover:bg-accent/50"
              )}
            >
              <div>
                <div className="text-sm font-medium">{model.name}</div>
                <div className="text-xs text-muted-foreground">{model.description}</div>
              </div>
              {builtinModel === model.id && (
                <span className="text-xs font-medium text-primary flex items-center gap-1">
                  <Check size={12} />
                  {t.settings.currentSelection}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 自定义模型列表 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {t.settings.customModels}
          </h3>
          <Button variant="ghost" size="sm" onClick={handleOpenAdd} className="h-7 gap-1">
            <Plus size={14} />
            {t.settings.addCustomModel}
          </Button>
        </div>
        {customModels.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
            {t.settings.customDesc}
          </div>
        ) : (
          <div className="space-y-1.5">
            {customModels.map((model) => (
              <div
                key={model.id}
                className={cn(
                  "flex items-center justify-between px-4 py-3 rounded-lg transition-colors",
                  isCustomActive(model.id) ? "bg-accent" : "hover:bg-accent/50"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {model.name}
                    {isCustomActive(model.id) && (
                      <span className="text-xs font-medium text-primary flex items-center gap-1">
                        <Check size={12} />
                        {t.settings.currentSelection}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{model.modelId}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!isCustomActive(model.id) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleSetCustomActive(model.id)}
                    >
                      {t.settings.setDefault}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleOpenEdit(model)}
                  >
                    <Pencil size={13} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteModel(model.id)}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 添加/编辑 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[90vw] max-w-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingModel ? t.settings.editModel : t.settings.addCustomModel}
          </h2>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t.settings.modelName}</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onBlur={() => handleBlur('name')}
                placeholder={t.settings.modelNamePlaceholder}
                className={touched.name && formErrors.name ? 'border-destructive' : ''}
              />
              {touched.name && formErrors.name && (
                <p className="text-xs text-destructive">{formErrors.name}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{t.settings.modelId}</Label>
              <Input
                value={formModelId}
                onChange={(e) => setFormModelId(e.target.value)}
                onBlur={() => handleBlur('modelId')}
                placeholder={t.settings.modelIdPlaceholder}
                className={touched.modelId && formErrors.modelId ? 'border-destructive' : ''}
              />
              {touched.modelId && formErrors.modelId && (
                <p className="text-xs text-destructive">{formErrors.modelId}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>API Key</Label>
              <Input
                type="password"
                value={formApiKey}
                onChange={(e) => setFormApiKey(e.target.value)}
                onBlur={() => handleBlur('apiKey')}
                placeholder={editingModel ? t.settings.apiKeyEditPlaceholder ?? "Leave empty to keep current key" : t.settings.apiKeyPlaceholder}
                className={touched.apiKey && formErrors.apiKey ? 'border-destructive' : ''}
              />
              {touched.apiKey && formErrors.apiKey && (
                <p className="text-xs text-destructive">{formErrors.apiKey}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Base URL</Label>
              <Input
                value={formBaseUrl}
                onChange={(e) => setFormBaseUrl(e.target.value)}
                onBlur={() => handleBlur('baseUrl')}
                placeholder={t.settings.baseUrlPlaceholder}
                className={touched.baseUrl && formErrors.baseUrl ? 'border-destructive' : ''}
              />
              {touched.baseUrl && formErrors.baseUrl && (
                <p className="text-xs text-destructive">{formErrors.baseUrl}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button onClick={handleSaveModel} disabled={hasErrors}>
                {t.common.save}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
