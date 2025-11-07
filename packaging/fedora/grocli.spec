Name:           grocli
Version:        0.1.0
Release:        1%{?dist}
Summary:        Shared grocery and shopping lists for households

License:        MIT
URL:            https://app.grocli.net
Source0:        %{name}-%{version}.tar.gz

BuildRequires:  rust-packaging
BuildRequires:  cargo
BuildRequires:  make
BuildRequires:  desktop-file-utils
BuildRequires:  gtk3
BuildRequires:  libappindicator-gtk3

%description
GrocLi makes shared shopping simple. Create grocery lists that sync instantly
between household members. Check items off in real-time, stay coordinated,
and avoid buying doubles. Perfect for families, partners, and roommates.

%prep
%autosetup -n %{name}-%{version}

# Ensure cargo uses vendored crates (no network)
mkdir -p .cargo
cat > .cargo/config.toml <<'EOF'
[source.crates-io]
replace-with = "vendored-sources"

[source.vendored-sources]
directory = "vendor"
EOF

%build
pushd src-tauri
%cargo_prep
%cargo_build
popd

%install
pushd src-tauri
%cargo_install
popd

# Rename binary to grocli
mv %{buildroot}%{_bindir}/app %{buildroot}%{_bindir}/grocli

# Install desktop file
install -Dm0644 src-tauri/assets/io.grocli.GrocLi.desktop \
    %{buildroot}%{_datadir}/applications/io.grocli.GrocLi.desktop

# Install icon
install -Dm0644 src-tauri/icons/io.grocli.GrocLi.png \
    %{buildroot}%{_datadir}/icons/hicolor/512x512/apps/io.grocli.GrocLi.png

# Install metainfo
install -Dm0644 src-tauri/metadata/io.grocli.GrocLi.metainfo.xml \
    %{buildroot}%{_datadir}/metainfo/io.grocli.GrocLi.metainfo.xml

%check
desktop-file-validate %{buildroot}%{_datadir}/applications/io.grocli.GrocLi.desktop

%files
%license LICENSE*
%doc README*
%{_bindir}/grocli
%{_datadir}/applications/io.grocli.GrocLi.desktop
%{_datadir}/icons/hicolor/512x512/apps/io.grocli.GrocLi.png
%{_datadir}/metainfo/io.grocli.GrocLi.metainfo.xml

%changelog
* Thu Nov 07 2025 Thijs <info@grocli.net> 0.1.0-1
- Initial Fedora package for GrocLi
