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

export function DeveloperMcpSettingsPage() {
  return (
    <SettingsPage>
      <SettingsPageContent className="flex flex-col gap-8">
        <SettingsPageTitle>MCP</SettingsPageTitle>

        <SettingsSection>
          <SettingsSectionTitle>MCP access</SettingsSectionTitle>
          <SettingsCard>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>MCP authorization</SettingsRowTitle>
                <SettingsRowDescription>
                  MCP access will use the same workspace OAuth and token scopes as the API.
                </SettingsRowDescription>
              </SettingsRowLabel>
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>
      </SettingsPageContent>
    </SettingsPage>
  )
}
