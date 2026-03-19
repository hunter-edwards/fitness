"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Loader2, LogOut, Save, Copy, RefreshCw, Smartphone } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import type { Database } from "@/types/database"

type Profile = Database["public"]["Tables"]["profiles"]["Row"]

export default function SettingsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [displayName, setDisplayName] = useState("")
  const [heightInches, setHeightInches] = useState("")
  const [dob, setDob] = useState("")
  const [gender, setGender] = useState("")
  const [activityLevel, setActivityLevel] = useState("")
  const [unitSystem, setUnitSystem] = useState("imperial")

  // Apple Health sync state
  const [syncToken, setSyncToken] = useState<string | null>(null)
  const [syncActive, setSyncActive] = useState(false)
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  const [generatingToken, setGeneratingToken] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfile(data)
          setDisplayName(data.display_name || "")
          setHeightInches(data.height_cm ? (data.height_cm / 2.54).toFixed(1) : "")
          setDob(data.date_of_birth || "")
          setGender(data.gender || "")
          setActivityLevel(data.activity_level || "")
          setUnitSystem(data.unit_system || "imperial")
        }
        setLoading(false)
      })

    // Fetch sync token
    supabase
      .from("health_sync_tokens")
      .select("token, is_active, last_synced_at")
      .eq("user_id", user.id)
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setSyncToken(data[0].token)
          setSyncActive(data[0].is_active)
          setLastSynced(data[0].last_synced_at)
        }
      })
  }, [user, supabase])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName || null,
        height_cm: heightInches ? parseFloat(heightInches) * 2.54 : null,
        date_of_birth: dob || null,
        gender: (gender as "male" | "female" | "other") || null,
        activity_level: (activityLevel as "sedentary" | "light" | "moderate" | "active" | "very_active") || null,
        unit_system: unitSystem as "metric" | "imperial",
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)

    if (error) {
      toast.error("Failed to save settings")
    } else {
      toast.success("Settings saved!")
    }
    setSaving(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  async function generateSyncToken() {
    if (!user) return
    setGeneratingToken(true)
    const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

    if (syncToken) {
      // Regenerate: update existing
      await supabase
        .from("health_sync_tokens")
        .update({ token, is_active: true })
        .eq("user_id", user.id)
    } else {
      // Create new
      await supabase.from("health_sync_tokens").insert({
        user_id: user.id,
        token,
        is_active: true,
      })
    }

    setSyncToken(token)
    setSyncActive(true)
    setGeneratingToken(false)
    toast.success(syncToken ? "Token regenerated" : "Sync token created")
  }

  async function toggleSyncActive(active: boolean) {
    if (!user) return
    setSyncActive(active)
    await supabase
      .from("health_sync_tokens")
      .update({ is_active: active })
      .eq("user_id", user.id)
    toast.success(active ? "Sync enabled" : "Sync disabled")
  }

  function copyToken() {
    if (syncToken) {
      navigator.clipboard.writeText(syncToken)
      toast.success("Token copied to clipboard")
    }
  }

  if (loading) {
    return (
      <>
        <Header title="Settings" />
        <div className="p-4 lg:p-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    )
  }

  return (
    <>
      <Header title="Settings" />
      <div className="p-4 lg:p-8 max-w-lg mx-auto space-y-6">
        <div className="hidden lg:block">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your profile and preferences</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email || ""} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="height">Height (inches)</Label>
                  <Input
                    id="height"
                    type="number"
                    step="0.1"
                    value={heightInches}
                    onChange={(e) => setHeightInches(e.target.value)}
                    placeholder="70"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select value={gender} onValueChange={(v) => v && setGender(v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Activity Level</Label>
                  <Select value={activityLevel} onValueChange={(v) => v && setActivityLevel(v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sedentary">Sedentary</SelectItem>
                      <SelectItem value="light">Lightly Active</SelectItem>
                      <SelectItem value="moderate">Moderately Active</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="very_active">Very Active</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Unit System</Label>
                <Select value={unitSystem} onValueChange={(v) => v && setUnitSystem(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="imperial">Imperial (lbs, miles)</SelectItem>
                    <SelectItem value="metric">Metric (kg, km)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Settings
              </Button>
            </form>
          </CardContent>
        </Card>

        <Separator />

        {/* Apple Health Sync */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Apple Health Sync
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sync steps, calories, and activity data from Apple Health using an
              iOS Shortcut. Generate a token below and use it in the Shortcut.
            </p>

            {syncToken ? (
              <>
                <div className="space-y-2">
                  <Label>Sync Token</Label>
                  <div className="flex gap-2">
                    <Input
                      value={syncToken}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copyToken}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Sync Enabled</Label>
                    <p className="text-xs text-muted-foreground">
                      {lastSynced
                        ? `Last synced: ${new Date(lastSynced).toLocaleString()}`
                        : "Never synced"}
                    </p>
                  </div>
                  <Switch
                    checked={syncActive}
                    onCheckedChange={toggleSyncActive}
                  />
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateSyncToken}
                  disabled={generatingToken}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Regenerate Token
                </Button>
              </>
            ) : (
              <Button
                onClick={generateSyncToken}
                disabled={generatingToken}
              >
                {generatingToken && (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                )}
                Generate Sync Token
              </Button>
            )}

            <Separator />

            <div className="space-y-2">
              <p className="text-sm font-medium">Setup Instructions</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Generate a sync token above</li>
                <li>
                  Create an Apple Shortcut that reads Health data (steps,
                  active energy, exercise minutes, distance)
                </li>
                <li>
                  Add a &quot;Get Contents of URL&quot; action that POSTs to{" "}
                  <code className="bg-muted px-1 rounded">
                    {typeof window !== "undefined"
                      ? window.location.origin
                      : ""}/api/health-sync
                  </code>
                </li>
                <li>
                  Set the Authorization header to{" "}
                  <code className="bg-muted px-1 rounded">
                    Bearer {"<your-token>"}
                  </code>
                </li>
                <li>
                  Run the Shortcut manually or set up an automation to run
                  daily
                </li>
              </ol>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardContent className="pt-6">
            <Button variant="destructive" className="w-full" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
