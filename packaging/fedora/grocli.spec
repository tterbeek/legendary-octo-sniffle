Name:           grocli
Version:        0.1.0
Release:        1%{?dist}
Summary:        Shared grocery list app for households

License:        MIT
URL:            https://app.grocli.net
Source0:        %{name}-%{version}.tar.gz

ExclusiveArch:  x86_64

Requires:       gtk3

%description
GrocLi is a shared grocery list app that syncs between household members.

%prep
%setup -q

%build
# Tauri already built the binary; nothing to do here.

%install
install -Dpm0755 target/release/app %{buildroot}/usr/bin/grocli
install -Dpm0644 src-tauri/assets/io.grocli.GrocLi.desktop %{buildroot}/usr/share/applications/io.grocli.GrocLi.desktop
install -Dpm0644 src-tauri/icons/io.grocli.GrocLi.png %{buildroot}/usr/share/icons/hicolor/512x512/apps/io.grocli.GrocLi.png

%files
/usr/bin/grocli
/usr/share/applications/io.grocli.GrocLi.desktop
/usr/share/icons/hicolor/512x512/apps/io.grocli.GrocLi.png

%changelog
* Wed Nov 6 2025 Thijs <info@grocli.net> 0.1.0-1
- Initial RPM release
