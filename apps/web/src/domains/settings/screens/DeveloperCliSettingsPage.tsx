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

export function DeveloperCliSettingsPage() {
  return (
    <SettingsPage>
      <SettingsPageContent className="flex flex-col gap-8">
        <SettingsPageTitle>CLI</SettingsPageTitle>

        <SettingsSection>
          <SettingsSectionTitle>Command line access</SettingsSectionTitle>
          <SettingsCard>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>CLI tokens</SettingsRowTitle>
                <SettingsRowDescription>
                  Use workspace API tokens with read, write, or manage intent scopes.
                </SettingsRowDescription>
              </SettingsRowLabel>
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>
      </SettingsPageContent>
    </SettingsPage>
  )
}
