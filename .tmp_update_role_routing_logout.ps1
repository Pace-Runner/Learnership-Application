$path = 'E:\UNI\Year 3\Learnership-Application\frontend\src\RoleBasedRouting.test.jsx'
$text = Get-Content -Raw $path
$oldMock = @'
vi.mock('./pages/Provider', () => ({
  default: () => <div>Provider Profile Workspace</div>,
}))
'@
$newMock = @'
vi.mock('./pages/Provider', () => ({
  default: ({ onLogout }) => (
    <div>
      Provider Profile Workspace
      <button onClick={onLogout}>Logout</button>
    </div>
  ),
}))
'@
$oldTest = @'
    screen.getByRole('button', { name: 'Logout' }).click()

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
      expect(screen.getByText(/BUILDING TALENT/i)).toBeTruthy()
    })
'@
$newTest = @'
    screen.getByRole('button', { name: 'Logout' }).click()

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
    })
    expect(await screen.findByText(/BUILDING TALENT/i)).toBeTruthy()
'@
if (-not $text.Contains($oldMock)) { throw 'Provider mock anchor not found' }
if (-not $text.Contains($oldTest)) { throw 'Logout test anchor not found' }
$text = $text.Replace($oldMock, $newMock)
$text = $text.Replace($oldTest, $newTest)
Set-Content -Path $path -Value $text
Remove-Item $PSCommandPath -Force
