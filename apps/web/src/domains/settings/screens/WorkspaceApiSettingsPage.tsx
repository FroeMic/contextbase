import {
  SettingsCard,
  SettingsPage,
  SettingsPageContent,
  SettingsPageTitle,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
  SettingsSection,
  SettingsSectionTitle,
} from "../components/SettingsLayout"

export function WorkspaceApiSettingsPage() {
  return (
    <SettingsPage>
      <SettingsPageContent className="flex flex-col gap-8">
        <SettingsPageTitle>API</SettingsPageTitle>

        <SettingsSection>
          <SettingsSectionTitle>Workspace API keys</SettingsSectionTitle>
          <SettingsCard>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>Token scopes</SettingsRowTitle>
                <SettingsRowDescription>
                  Workspace API tokens use Contextbase read, write, and manage intents.
                </SettingsRowDescription>
              </SettingsRowLabel>
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>
      </SettingsPageContent>
    </SettingsPage>
  )
}
