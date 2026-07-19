import { getAdminSettingValue } from "@/lib/admin-settings"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

export async function getMetaCapiConfig() {
  const environmentPixelId = clean(process.env.META_PIXEL_ID, 120)
  const environmentAccessToken = clean(process.env.META_PIXEL_ACCESS_TOKEN, 1000)
  const environmentApiVersion = clean(process.env.META_GRAPH_API_VERSION, 20)

  const [settingPixelId, settingAccessToken, settingApiVersion] = await Promise.all([
    environmentPixelId ? Promise.resolve("") : getAdminSettingValue("META_PIXEL_ID"),
    environmentAccessToken ? Promise.resolve("") : getAdminSettingValue("META_PIXEL_ACCESS_TOKEN"),
    environmentApiVersion ? Promise.resolve("") : getAdminSettingValue("META_GRAPH_API_VERSION")
  ])

  const pixelId = environmentPixelId
    || clean(settingPixelId, 120)
    || clean(process.env.NEXT_PUBLIC_META_PIXEL_ID, 120)
  const accessToken = environmentAccessToken || clean(settingAccessToken, 1000)
  const rawVersion = environmentApiVersion || clean(settingApiVersion, 20) || "v25.0"
  const apiVersion = rawVersion.startsWith("v") ? rawVersion : `v${rawVersion}`

  return {
    pixelId,
    accessToken,
    apiVersion,
    pixelSource: environmentPixelId ? "environment" : settingPixelId ? "admin_setting" : "public_environment",
    tokenSource: environmentAccessToken ? "environment" : settingAccessToken ? "admin_setting" : "missing",
    versionSource: environmentApiVersion ? "environment" : settingApiVersion ? "admin_setting" : "default"
  }
}
