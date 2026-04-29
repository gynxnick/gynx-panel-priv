@extends('layouts.admin')
@include('partials/admin.settings.nav', ['activeTab' => 'addon-games'])

@section('title')
    Addon Game Registry
@endsection

@section('content-header')
    <h1>Addon Game Registry<small>Map server eggs to addon source catalogues (CurseForge / Thunderstore / Modrinth).</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li><a href="{{ route('admin.settings') }}">Settings</a></li>
        <li class="active">Addon Games</li>
    </ol>
@endsection

@section('content')
    @yield('settings::nav')

    <div class="row">
        <div class="col-xs-12">
            <div class="alert alert-info">
                The installer side panel only lists sources that match the server's classified game. Detection runs against the egg's <code>features</code> array, the docker image, and the egg + nest names. If a server lands on "No registries match", look at <strong>Diagnose this server</strong> below to see what the egg actually exposes, then add a custom row whose <strong>Pattern</strong> contains a substring of any of those values.
            </div>
        </div>
    </div>

    {{-- Diagnose --}}
    <div class="row">
        <div class="col-xs-12">
            <div class="box">
                <div class="box-header with-border">
                    <h3 class="box-title">Diagnose a server</h3>
                </div>
                <div class="box-body">
                    <div class="row">
                        <div class="form-group col-md-6">
                            <label class="control-label">Server UUID (full or short)</label>
                            <input id="diagUuid" type="text" class="form-control" placeholder="e.g. 1a7ce997 or 1a7ce997-..." />
                            <p class="text-muted small">Returns the egg / nest / image / features the registry sees and whether any rule currently matches.</p>
                        </div>
                        <div class="form-group col-md-6">
                            <label class="control-label">&nbsp;</label>
                            <div>
                                <button type="button" id="diagButton" class="btn btn-sm btn-default">Diagnose</button>
                            </div>
                        </div>
                    </div>
                    <pre id="diagOutput" style="display:none; background:#f5f5f5; padding:8px 12px; border-radius:3px; max-height:300px; overflow:auto;"></pre>
                </div>
            </div>
        </div>
    </div>

    {{-- Built-in --}}
    <div class="row">
        <div class="col-xs-12">
            <div class="box">
                <div class="box-header with-border">
                    <h3 class="box-title">Built-in mappings <small>read-only — extend by adding a custom row with the same slug</small></h3>
                </div>
                <div class="box-body" style="overflow:auto">
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Slug</th>
                                <th>Patterns</th>
                                <th>CF gameId</th>
                                <th>TS community</th>
                                <th>Supports</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach($builtIn as $slug => $cfg)
                                <tr>
                                    <td><code>{{ $slug }}</code></td>
                                    <td style="max-width: 420px"><code style="word-break:break-word">{{ implode(', ', $cfg['patterns']) }}</code></td>
                                    <td>{{ $cfg['curseforge_id'] ?? '—' }}</td>
                                    <td>{{ $cfg['thunderstore_community'] ?? '—' }}</td>
                                    <td>{{ implode(' / ', $cfg['supports']) }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    {{-- Custom --}}
    <div class="row">
        <div class="col-xs-12">
            <div class="box">
                <div class="box-header with-border">
                    <h3 class="box-title">Custom mappings</h3>
                    <div class="box-tools pull-right">
                        <button type="button" class="btn btn-sm btn-default" id="addRowButton"><i class="fa fa-plus"></i>&nbsp;Add row</button>
                    </div>
                </div>
                <div class="box-body">
                    <div id="rowsContainer">
                        @forelse($custom as $slug => $cfg)
                            <div class="row addon-row" style="border:1px solid var(--gynx-edge,#e0e0e0); border-radius:4px; padding:12px 12px 0; margin: 0 0 12px;">
                                <div class="form-group col-md-3">
                                    <label class="control-label">Slug</label>
                                    <input type="text" class="form-control row-slug" value="{{ $slug }}" />
                                    <p class="text-muted small">Use a built-in slug (e.g. <code>minecraft</code>) to extend it; or anything else for a new game.</p>
                                </div>
                                <div class="form-group col-md-3">
                                    <label class="control-label">CurseForge gameId <span class="field-optional"></span></label>
                                    <input type="number" min="1" class="form-control row-cfid" value="{{ $cfg['curseforge_id'] ?? '' }}" />
                                </div>
                                <div class="form-group col-md-3">
                                    <label class="control-label">Thunderstore community <span class="field-optional"></span></label>
                                    <input type="text" class="form-control row-tscomm" value="{{ $cfg['thunderstore_community'] ?? '' }}" placeholder="e.g. valheim, lethal-company" />
                                </div>
                                <div class="form-group col-md-3">
                                    <label class="control-label">Supports</label>
                                    <div>
                                        @foreach($addonTypes as $t)
                                            <label class="checkbox-inline">
                                                <input type="checkbox" class="row-supports" value="{{ $t }}" @if(in_array($t, $cfg['supports'] ?? [], true)) checked @endif /> {{ $t }}
                                            </label>
                                        @endforeach
                                    </div>
                                </div>
                                <div class="form-group col-md-12">
                                    <label class="control-label">Patterns (one per line, lower-case substring match against egg name + nest + docker image)</label>
                                    <textarea class="form-control row-patterns" rows="3">{{ implode("\n", $cfg['patterns'] ?? []) }}</textarea>
                                </div>
                                <div class="form-group col-md-12" style="text-align:right;">
                                    <button type="button" class="btn btn-sm btn-danger row-remove">Remove</button>
                                </div>
                            </div>
                        @empty
                            {{-- empty state — JS adds rows on Add row --}}
                        @endforelse
                    </div>
                    <p class="text-muted small" id="emptyHint" @if(count($custom) > 0) style="display:none" @endif>No custom mappings. Built-ins above are active. Click "Add row" to extend Minecraft patterns or wire a new game.</p>
                </div>
                <div class="box-footer">
                    {{ csrf_field() }}
                    <div class="pull-right">
                        <button type="button" class="btn btn-sm btn-primary" id="saveButton">Save</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    {{-- Row template (cloned by JS) --}}
    <template id="rowTemplate">
        <div class="row addon-row" style="border:1px solid #e0e0e0; border-radius:4px; padding:12px 12px 0; margin: 0 0 12px;">
            <div class="form-group col-md-3">
                <label class="control-label">Slug</label>
                <input type="text" class="form-control row-slug" />
            </div>
            <div class="form-group col-md-3">
                <label class="control-label">CurseForge gameId</label>
                <input type="number" min="1" class="form-control row-cfid" />
            </div>
            <div class="form-group col-md-3">
                <label class="control-label">Thunderstore community</label>
                <input type="text" class="form-control row-tscomm" placeholder="e.g. valheim" />
            </div>
            <div class="form-group col-md-3">
                <label class="control-label">Supports</label>
                <div>
                    <label class="checkbox-inline"><input type="checkbox" class="row-supports" value="plugin" /> plugin</label>
                    <label class="checkbox-inline"><input type="checkbox" class="row-supports" value="mod" /> mod</label>
                    <label class="checkbox-inline"><input type="checkbox" class="row-supports" value="modpack" /> modpack</label>
                </div>
            </div>
            <div class="form-group col-md-12">
                <label class="control-label">Patterns (one per line)</label>
                <textarea class="form-control row-patterns" rows="3"></textarea>
            </div>
            <div class="form-group col-md-12" style="text-align:right;">
                <button type="button" class="btn btn-sm btn-danger row-remove">Remove</button>
            </div>
        </div>
    </template>
@endsection

@section('footer-scripts')
    @parent

    <script>
        function collectRows() {
            var rows = [];
            $('#rowsContainer .addon-row').each(function () {
                var $r = $(this);
                rows.push({
                    slug: $r.find('.row-slug').val(),
                    patterns: $r.find('.row-patterns').val(),
                    curseforge_id: $r.find('.row-cfid').val() || null,
                    thunderstore_community: $r.find('.row-tscomm').val() || null,
                    supports: $r.find('.row-supports:checked').map(function () { return this.value; }).get(),
                });
            });
            return rows;
        }

        function addRow() {
            var tpl = document.getElementById('rowTemplate').content.cloneNode(true);
            $('#rowsContainer').append(tpl);
            $('#emptyHint').hide();
        }

        function showError(jqXHR, verb) {
            console.error(jqXHR);
            var t = '';
            if (!jqXHR.responseJSON) {
                t = jqXHR.responseText || jqXHR.statusText;
            } else if (jqXHR.responseJSON.errors) {
                $.each(jqXHR.responseJSON.errors, function (i, v) {
                    if (v.detail) t += v.detail + ' ';
                });
            } else if (jqXHR.responseJSON.error) {
                t = jqXHR.responseJSON.error;
            }
            swal({ title: 'Whoops!', text: 'Could not ' + verb + ': ' + t, type: 'error' });
        }

        $(document).ready(function () {
            $('#addRowButton').on('click', addRow);

            $(document).on('click', '.row-remove', function () {
                $(this).closest('.addon-row').remove();
                if ($('#rowsContainer .addon-row').length === 0) $('#emptyHint').show();
            });

            $('#saveButton').on('click', function () {
                $.ajax({
                    method: 'PATCH',
                    url: '/admin/settings/addon-games',
                    contentType: 'application/json',
                    data: JSON.stringify({ games: collectRows() }),
                    headers: { 'X-CSRF-Token': $('input[name="_token"]').val() }
                }).done(function () {
                    swal({ title: 'Saved', text: 'Addon game mappings updated.', type: 'success', timer: 1400, showConfirmButton: false });
                }).fail(function (jq) { showError(jq, 'save'); });
            });

            $('#diagButton').on('click', function () {
                var uuid = $('#diagUuid').val().trim();
                if (!uuid) return;
                $.ajax({
                    method: 'POST',
                    url: '/admin/settings/addon-games/diagnose',
                    contentType: 'application/json',
                    data: JSON.stringify({ server_uuid: uuid }),
                    headers: { 'X-CSRF-Token': $('input[name="_token"]').val() }
                }).done(function (res) {
                    var data = res.data || {};
                    var $out = $('#diagOutput');
                    var lines = [];
                    lines.push('Server: ' + (data.server && data.server.name) + ' (' + (data.server && data.server.uuid) + ')');
                    if (data.signals) {
                        lines.push('');
                        lines.push('egg name:   ' + (data.signals.egg_name || '(empty)'));
                        lines.push('nest name:  ' + (data.signals.nest_name || '(empty)'));
                        lines.push('image:      ' + (data.signals.image || '(empty)'));
                        lines.push('features:   ' + (data.signals.features || []).join(', '));
                        lines.push('haystack:   ' + (data.signals.haystack || ''));
                    }
                    lines.push('');
                    if (data.resolved) {
                        lines.push('=> resolved to: ' + data.resolved.slug);
                        lines.push('   curseforge_id: ' + (data.resolved.curseforge_id || '—'));
                        lines.push('   thunderstore_community: ' + (data.resolved.thunderstore_community || '—'));
                        lines.push('   supports: ' + (data.resolved.supports || []).join(', '));
                    } else {
                        lines.push('=> NO MATCH. Add a custom row with a pattern that appears in the haystack.');
                    }
                    $out.text(lines.join('\n')).show();
                }).fail(function (jq) { showError(jq, 'diagnose'); });
            });
        });
    </script>
@endsection
